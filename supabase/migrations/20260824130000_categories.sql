-- DevAtlas — Phase 2, Part 1: admin-managed categories
--
-- Categories move from a fixed per-resource-type Postgres enum
-- (prompt_category) to a shared, admin-managed table so a new category can
-- be added without a schema migration — the same way `tags` already lets
-- any signed-in user add a new tag, except category creation stays
-- admin-gated: categories drive the shared filter/legend UI, so letting any
-- signed-in user freely invent one (tags' model) would fragment it.
--
-- Staged rollout, not a single cutover: this migration is purely additive.
-- It does NOT touch prompts.category (the existing prompt_category enum
-- column) or drop anything — `category_id` is added alongside it and
-- backfilled, `search_prompts` gains an optional `p_category_id` param
-- without removing `p_category`, and `category`'s NOT NULL is relaxed so
-- new code can omit it. The old enum column/type and the old `p_category`
-- RPC param are deliberately left in place until the app code that
-- switches over to category_id is deployed and confirmed working —
-- dropping them now would break the currently-live app immediately, since
-- it still reads/writes `category` the old way. See PRODUCTION_CHECKLIST.md
-- for the follow-up migration to run once that's confirmed.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('prompt', 'skill', 'connector')),
  key text not null,
  label text not null,
  color text not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (resource_type, key)
);

create index categories_resource_type_idx on public.categories(resource_type, sort_order);

alter table public.categories enable row level security;

-- Read: any signed-in user (matches tags_select_signed_in). Write: admin
-- only (unlike tags — categories drive shared filter/legend UI, not a
-- free-for-all vocabulary).
create policy "categories_select_signed_in" on public.categories
  for select to authenticated
  using (true);

create policy "categories_insert_admin" on public.categories
  for insert to authenticated
  with check (is_admin((select auth.uid())));

create policy "categories_update_admin" on public.categories
  for update to authenticated
  using (is_admin((select auth.uid())))
  with check (is_admin((select auth.uid())));

create policy "categories_delete_admin" on public.categories
  for delete to authenticated
  using (is_admin((select auth.uid())));

-- Seed the 5 existing prompt categories — matches
-- lib/constants/categories/prompts.ts and the prompt_category enum values
-- exactly, so the category_id backfill below can join on `key`.
insert into public.categories (resource_type, key, label, color, sort_order) values
  ('prompt', 'new_app', 'New App', 'var(--cat-new-app)', 1),
  ('prompt', 'module_feature', 'Module / Feature', 'var(--cat-module-feature)', 2),
  ('prompt', 'debugging', 'Debugging', 'var(--cat-debugging)', 3),
  ('prompt', 'frontend', 'Frontend', 'var(--cat-frontend)', 4),
  ('prompt', 'backend', 'Backend', 'var(--cat-backend)', 5);

alter table public.prompts
  add column category_id uuid references public.categories(id),
  alter column category drop not null;

update public.prompts p
  set category_id = c.id
  from public.categories c
  where c.resource_type = 'prompt' and c.key = p.category::text;

alter table public.prompts
  alter column category_id set not null;

create index prompts_category_id_idx on public.prompts(category_id);

-- Additive RPC overload: existing callers passing p_category keep working
-- unchanged (default null for the new param is a no-op); new callers pass
-- p_category_id instead. Once the frontend that uses p_category_id is
-- deployed and confirmed, a follow-up migration removes p_category, this
-- column, and the enum type entirely.
create or replace function public.search_prompts(
  p_category prompt_category default null,
  p_tags text[] default null,
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0,
  p_category_id uuid default null
)
returns setof public.prompts as $$
  select p.*
  from public.prompts p
  where p.status = 'approved'
    and (p_category is null or p.category = p_category)
    and (p_category_id is null or p.category_id = p_category_id)
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
  order by p.created_at desc, p.id
  limit p_limit offset p_offset;
$$ language sql stable security invoker set search_path = public;
