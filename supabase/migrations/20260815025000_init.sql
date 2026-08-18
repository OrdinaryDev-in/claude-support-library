-- DevAtlas — Phase 1: Prompt Library
-- Core schema: profiles, prompts, tags, prompt_tags.
--
-- Every resource-type table (prompts now; skills/connectors later) follows
-- the same common convention so future tables are additive siblings, not a
-- retrofit: id, author_id, title, slug, description, a type-specific
-- category enum, is_published, created_at, updated_at.

create extension if not exists pgcrypto;

-- ─── shared trigger: bump updated_at on every row update ───────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── profiles ────────────────────────────────────────────────────────
-- Mirrors auth.users. Auto-populated on signup (see handle_new_user below),
-- which is how "basic account records" is satisfied for free.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- helper used throughout RLS: is this uid an admin?
create or replace function public.is_admin(uid uuid)
returns boolean as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin'
  );
$$ language sql security definer stable set search_path = public;

-- ─── prompts (Phase 1 resource table) ───────────────────────────────
create type prompt_category as enum (
  'new_app',
  'module_feature',
  'debugging',
  'frontend',
  'backend'
);

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,

  title text not null,
  slug text not null unique,
  description text not null,
  category prompt_category not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- structured template sections — each its own labeled block in the UI,
  -- assembled into one copy-paste string at render/copy time (no
  -- duplicated blob column to keep in sync).
  base_instructions text not null,           -- AI role / task-type framing
  fill_in_details_guidance text not null,    -- bracketed placeholders: [APP DESCRIPTION], [TECH STACK]...
  reference_projects_guidance text not null, -- how to paste similar-prior-work links/descriptions
  reference_links_guidance text not null,    -- placeholders for cloud/docs reference links
  expected_output_notes text not null,       -- what a correct AI response must include

  view_count integer not null default 0
);

create index prompts_category_idx on public.prompts(category);
create index prompts_author_idx on public.prompts(author_id);
create index prompts_published_idx on public.prompts(is_published);
create index prompts_search_idx on public.prompts
  using gin (
    to_tsvector('english', title || ' ' || description || ' ' || base_instructions)
  );

create trigger prompts_set_updated_at
  before update on public.prompts
  for each row execute procedure public.set_updated_at();

-- ─── tags + prompt_tags ──────────────────────────────────────────────
-- `tags` is a shared, cross-resource-type vocabulary: a future skill or
-- connector reuses the same table via its own join table.
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
);

create table public.prompt_tags (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (prompt_id, tag_id)
);

create index prompt_tags_tag_idx on public.prompt_tags(tag_id);

-- ─── search_prompts RPC ──────────────────────────────────────────────
-- Centralizes category + tag + free-text filtering in one tested function
-- instead of duplicating query-builder logic in the app.
create or replace function public.search_prompts(
  p_category prompt_category default null,
  p_tags text[] default null,
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns setof public.prompts as $$
  select p.*
  from public.prompts p
  where (p_category is null or p.category = p_category)
    and (
      p_tags is null or array_length(p_tags, 1) is null or exists (
        select 1 from public.prompt_tags pt
        join public.tags t on t.id = pt.tag_id
        where pt.prompt_id = p.id and t.slug = any(p_tags)
      )
    )
    and (
      p_query is null or p_query = '' or
      to_tsvector('english', p.title || ' ' || p.description || ' ' || p.base_instructions)
        @@ websearch_to_tsquery('english', p_query)
      or p.title ilike '%' || p_query || '%'
    )
  order by p.created_at desc
  limit p_limit offset p_offset;
$$ language sql stable security invoker set search_path = public;
-- security invoker (the default, spelled out for clarity): this RPC must run
-- as the calling user so the prompts_select_signed_in RLS policy below still
-- applies — a security-definer search function would silently leak
-- unpublished / other-authors'-draft prompts to any caller.
