-- DevAtlas — Phase 2, Part 2b: Connectors library
--
-- Third resource type, additive to Prompts/Skills — same shared-column
-- convention (id, author_id, title, slug, description, category, status,
-- created_at, updated_at), same review workflow, same categories table
-- (resource_type = 'connector') from 20260824130000_categories.sql. Scope,
-- confirmed with the user: reference guides for wiring an AI coding agent
-- to external tools/data sources — MCP server setup, API-key/auth
-- patterns for tool use, tool-definition boilerplate — not cloud
-- infrastructure docs (the original stub description) and not Claude's
-- own "Connectors" feature. Deliberately structured fields fit this
-- domain instead of reusing Skills' agent-flavored ones.
--
-- Ships with the same full review-workflow hardening Skills shipped with
-- from the start (20260824140000_skills.sql) — service_role bypass,
-- insert-time forged-review-fields guard, tag-change resubmit trigger —
-- rather than repeating Prompts' original incremental-hardening history.

create type connector_status as enum ('pending_review', 'approved', 'rejected');

create table public.connectors (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,

  title text not null check (char_length(title) <= 140),
  slug text not null unique,
  description text not null check (char_length(description) <= 300),
  category_id uuid not null references public.categories(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- structured template sections, fit to this domain rather than reusing
  -- Prompts/Skills' guidance-field names.
  setup_steps text not null check (char_length(setup_steps) <= 20000),      -- install/config walkthrough
  config_snippet text not null check (char_length(config_snippet) <= 20000), -- e.g. an MCP server entry or API client boilerplate
  gotchas_notes text not null check (char_length(gotchas_notes) <= 20000),
  docs_links text not null check (char_length(docs_links) <= 20000),

  view_count integer not null default 0,

  status connector_status not null default 'pending_review',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text check (char_length(rejection_reason) <= 500),

  constraint connectors_rejection_reason_required check (status <> 'rejected' or rejection_reason is not null)
);

create index connectors_category_id_idx on public.connectors(category_id);
create index connectors_author_idx on public.connectors(author_id);
create index connectors_status_idx on public.connectors(status);
create index connectors_search_idx on public.connectors
  using gin (
    to_tsvector('english', title || ' ' || description || ' ' || setup_steps)
  );

create trigger connectors_set_updated_at
  before update on public.connectors
  for each row execute procedure public.set_updated_at();

-- ─── connector_tags ────────────────────────────────────────────────────
create table public.connector_tags (
  connector_id uuid not null references public.connectors(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (connector_id, tag_id)
);

create index connector_tags_tag_idx on public.connector_tags(tag_id);

-- ─── review-state guard trigger ───────────────────────────────────────
create or replace function public.guard_connector_review_state()
returns trigger as $$
declare
  is_service_role boolean := coalesce((current_setting('request.jwt.claims', true))::json->>'role', '') = 'service_role';
begin
  if public.is_admin((select auth.uid())) or is_service_role then
    if new.status is distinct from old.status then
      new.reviewed_by := (select auth.uid());
      new.reviewed_at := now();
    end if;
  else
    new.status := old.status;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.rejection_reason := old.rejection_reason;

    if old.status in ('approved', 'rejected') and (
      new.title is distinct from old.title or
      new.description is distinct from old.description or
      new.category_id is distinct from old.category_id or
      new.setup_steps is distinct from old.setup_steps or
      new.config_snippet is distinct from old.config_snippet or
      new.gotchas_notes is distinct from old.gotchas_notes or
      new.docs_links is distinct from old.docs_links or
      coalesce(current_setting('app.connector_tag_change_resubmit', true), '') = 'true'
    ) then
      new.status := 'pending_review';
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.rejection_reason := null;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.guard_connector_review_state() from public, anon, authenticated;

create trigger connectors_guard_review_state
  before update on public.connectors
  for each row execute procedure public.guard_connector_review_state();

-- ─── tag-change resubmit trigger ──────────────────────────────────────
create or replace function public.reset_connector_review_on_tag_change()
returns trigger as $$
declare
  target_connector_id uuid := coalesce(new.connector_id, old.connector_id);
  acting_uid uuid := (select auth.uid());
  is_service_role boolean := coalesce((current_setting('request.jwt.claims', true))::json->>'role', '') = 'service_role';
begin
  if acting_uid is not null and not (public.is_admin(acting_uid) or is_service_role) then
    perform set_config('app.connector_tag_change_resubmit', 'true', true);

    update public.connectors
    set status = 'pending_review'
    where id = target_connector_id
      and status in ('approved', 'rejected');

    perform set_config('app.connector_tag_change_resubmit', '', true);
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.reset_connector_review_on_tag_change() from public, anon, authenticated;

create trigger connector_tags_reset_review_state
  after insert or update or delete on public.connector_tags
  for each row execute procedure public.reset_connector_review_on_tag_change();

-- ─── RLS ───────────────────────────────────────────────────────────────
alter table public.connectors enable row level security;
alter table public.connector_tags enable row level security;

create policy "connectors_select_signed_in" on public.connectors
  for select to authenticated
  using (
    status = 'approved'
    or author_id = (select auth.uid())
    or is_admin((select auth.uid()))
  );

create policy "connectors_insert_own" on public.connectors
  for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      is_admin((select auth.uid()))
      or (
        status = 'pending_review'
        and reviewed_by is null
        and reviewed_at is null
        and rejection_reason is null
      )
    )
  );

create policy "connectors_update_owner_or_admin" on public.connectors
  for update to authenticated
  using ((select auth.uid()) = author_id or is_admin((select auth.uid())));

create policy "connectors_delete_owner_or_admin" on public.connectors
  for delete to authenticated
  using ((select auth.uid()) = author_id or is_admin((select auth.uid())));

create policy "connector_tags_select_signed_in" on public.connector_tags
  for select to authenticated
  using (true);

create policy "connector_tags_insert_owner_or_admin" on public.connector_tags
  for insert to authenticated
  with check (
    exists (
      select 1 from public.connectors c
      where c.id = connector_tags.connector_id
        and (c.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

create policy "connector_tags_update_owner_or_admin" on public.connector_tags
  for update to authenticated
  using (
    exists (
      select 1 from public.connectors c
      where c.id = connector_tags.connector_id
        and (c.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  )
  with check (
    exists (
      select 1 from public.connectors c
      where c.id = connector_tags.connector_id
        and (c.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

create policy "connector_tags_delete_owner_or_admin" on public.connector_tags
  for delete to authenticated
  using (
    exists (
      select 1 from public.connectors c
      where c.id = connector_tags.connector_id
        and (c.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

-- Table-level grants for `authenticated`/`service_role` are NOT added
-- explicitly here — same reasoning as 20260824140000_skills.sql: the
-- existing `alter default privileges` migrations already cover any table
-- created after them. RLS remains the real access boundary.

-- ─── search_connectors RPC ────────────────────────────────────────────
create or replace function public.search_connectors(
  p_category_id uuid default null,
  p_tags text[] default null,
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns setof public.connectors as $$
  select c.*
  from public.connectors c
  where c.status = 'approved'
    and (p_category_id is null or c.category_id = p_category_id)
    and (
      p_tags is null or array_length(p_tags, 1) is null or exists (
        select 1 from public.connector_tags ct
        join public.tags t on t.id = ct.tag_id
        where ct.connector_id = c.id and t.slug = any(p_tags)
      )
    )
    and (
      p_query is null or p_query = '' or
      to_tsvector('english', c.title || ' ' || c.description || ' ' || c.setup_steps)
        @@ websearch_to_tsquery('english', p_query)
      or c.title ilike '%' || p_query || '%'
    )
  order by c.created_at desc, c.id
  limit p_limit offset p_offset;
$$ language sql stable security invoker set search_path = public;

-- ─── starter categories ──────────────────────────────────────────────
insert into public.categories (resource_type, key, label, color, sort_order) values
  ('connector', 'mcp_server_setup', 'MCP Server Setup', 'var(--cat-new-app)', 1),
  ('connector', 'api_integration', 'API Integration', 'var(--cat-module-feature)', 2),
  ('connector', 'auth_and_tool_use', 'Auth & Tool Use', 'var(--cat-debugging)', 3),
  ('connector', 'data_source_connector', 'Data Source Connector', 'var(--cat-frontend)', 4),
  ('connector', 'browser_automation', 'Browser Automation', 'var(--cat-backend)', 5),
  ('connector', 'other', 'Other', '#e0a03d', 6);
