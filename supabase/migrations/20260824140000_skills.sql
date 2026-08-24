-- DevAtlas — Phase 2, Part 3: Skills library
--
-- Second resource type, additive to Prompts — same shared-column
-- convention documented in 20260815025000_init.sql (id, author_id, title,
-- slug, description, category, created_at, updated_at) plus five
-- skill-specific structured fields mirroring Prompts' five guidance
-- columns. Categories are NOT a new Postgres enum — skills.category_id
-- references the shared `categories` table from 20260824130000_categories.sql
-- (resource_type = 'skill'), avoiding the enum-to-table rework Prompts
-- needed in Part 1.
--
-- Unlike Prompts (which reached this shape over several incremental
-- hardening migrations — 0009/0014/0016/0017/0018/0019), Skills ships with
-- that full hardening from the start: the service_role bypass, the
-- insert-time forged-review-fields guard, and the tag-change resubmit
-- trigger are all here in one migration rather than three follow-ups.

create type skill_status as enum ('pending_review', 'approved', 'rejected');

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,

  title text not null check (char_length(title) <= 140),
  slug text not null unique,
  description text not null check (char_length(description) <= 300),
  category_id uuid not null references public.categories(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- structured template sections, same convention as prompts' five
  -- guidance columns — each its own labeled block in the UI, assembled
  -- into one copy-paste string at render/copy time.
  trigger_description text not null check (char_length(trigger_description) <= 20000),
  instructions_body text not null check (char_length(instructions_body) <= 20000),
  required_tools_guidance text not null check (char_length(required_tools_guidance) <= 20000),
  example_usage text not null check (char_length(example_usage) <= 20000),
  expected_output_notes text not null check (char_length(expected_output_notes) <= 20000),

  view_count integer not null default 0,

  status skill_status not null default 'pending_review',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text check (char_length(rejection_reason) <= 500),

  constraint skills_rejection_reason_required check (status <> 'rejected' or rejection_reason is not null)
);

create index skills_category_id_idx on public.skills(category_id);
create index skills_author_idx on public.skills(author_id);
create index skills_status_idx on public.skills(status);
create index skills_search_idx on public.skills
  using gin (
    to_tsvector('english', title || ' ' || description || ' ' || instructions_body)
  );

create trigger skills_set_updated_at
  before update on public.skills
  for each row execute procedure public.set_updated_at();

-- ─── skill_tags ──────────────────────────────────────────────────────
-- Reuses the shared `tags` table (its own comment already anticipated
-- this — see 20260815025000_init.sql) via its own join table.
create table public.skill_tags (
  skill_id uuid not null references public.skills(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (skill_id, tag_id)
);

create index skill_tags_tag_idx on public.skill_tags(tag_id);

-- ─── review-state guard trigger ───────────────────────────────────────
-- Direct copy of guard_prompt_review_state() in its final, fully-hardened
-- form (20260818110200_reset_review_on_tag_change.sql), field names
-- substituted for skills' own columns.
create or replace function public.guard_skill_review_state()
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
      new.trigger_description is distinct from old.trigger_description or
      new.instructions_body is distinct from old.instructions_body or
      new.required_tools_guidance is distinct from old.required_tools_guidance or
      new.example_usage is distinct from old.example_usage or
      new.expected_output_notes is distinct from old.expected_output_notes or
      coalesce(current_setting('app.skill_tag_change_resubmit', true), '') = 'true'
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

-- Not meant to be called directly — see the harden_definer_functions.sql
-- reasoning this repo already established for its sibling trigger
-- functions (only a trigger invokes it, independent of EXECUTE grants).
revoke execute on function public.guard_skill_review_state() from public, anon, authenticated;

create trigger skills_guard_review_state
  before update on public.skills
  for each row execute procedure public.guard_skill_review_state();

-- ─── tag-change resubmit trigger ──────────────────────────────────────
-- Same reasoning as reset_prompt_review_on_tag_change(): skill_tags rows
-- are a separate table gated only by skill ownership, not skills.status,
-- so a tags-only edit on an already-approved skill would otherwise never
-- re-enter the review queue.
create or replace function public.reset_skill_review_on_tag_change()
returns trigger as $$
declare
  target_skill_id uuid := coalesce(new.skill_id, old.skill_id);
  acting_uid uuid := (select auth.uid());
  is_service_role boolean := coalesce((current_setting('request.jwt.claims', true))::json->>'role', '') = 'service_role';
begin
  if acting_uid is not null and not (public.is_admin(acting_uid) or is_service_role) then
    perform set_config('app.skill_tag_change_resubmit', 'true', true);

    update public.skills
    set status = 'pending_review'
    where id = target_skill_id
      and status in ('approved', 'rejected');

    perform set_config('app.skill_tag_change_resubmit', '', true);
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.reset_skill_review_on_tag_change() from public, anon, authenticated;

create trigger skill_tags_reset_review_state
  after insert or update or delete on public.skill_tags
  for each row execute procedure public.reset_skill_review_on_tag_change();

-- ─── RLS ───────────────────────────────────────────────────────────────
alter table public.skills enable row level security;
alter table public.skill_tags enable row level security;

create policy "skills_select_signed_in" on public.skills
  for select to authenticated
  using (
    status = 'approved'
    or author_id = (select auth.uid())
    or is_admin((select auth.uid()))
  );

-- Insert-time forged-review-fields guard baked in from the start (mirrors
-- the fix 20260818110100_guard_prompt_insert_review_fields.sql had to add
-- after the fact for prompts): reviewed_by/reviewed_at/rejection_reason
-- must be unset unless the caller is admin.
create policy "skills_insert_own" on public.skills
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

create policy "skills_update_owner_or_admin" on public.skills
  for update to authenticated
  using ((select auth.uid()) = author_id or is_admin((select auth.uid())));

create policy "skills_delete_owner_or_admin" on public.skills
  for delete to authenticated
  using ((select auth.uid()) = author_id or is_admin((select auth.uid())));

create policy "skill_tags_select_signed_in" on public.skill_tags
  for select to authenticated
  using (true);

create policy "skill_tags_insert_owner_or_admin" on public.skill_tags
  for insert to authenticated
  with check (
    exists (
      select 1 from public.skills s
      where s.id = skill_tags.skill_id
        and (s.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

create policy "skill_tags_update_owner_or_admin" on public.skill_tags
  for update to authenticated
  using (
    exists (
      select 1 from public.skills s
      where s.id = skill_tags.skill_id
        and (s.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  )
  with check (
    exists (
      select 1 from public.skills s
      where s.id = skill_tags.skill_id
        and (s.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

create policy "skill_tags_delete_owner_or_admin" on public.skill_tags
  for delete to authenticated
  using (
    exists (
      select 1 from public.skills s
      where s.id = skill_tags.skill_id
        and (s.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

-- Table-level grants for `authenticated`/`service_role` are NOT added
-- explicitly here — 20260818110300_default_privileges_authenticated.sql
-- and 20260816112643_grant_service_role_table_privileges.sql already set
-- `alter default privileges ... grant ... on tables to authenticated /
-- service_role`, which applies automatically to any table created after
-- those migrations (confirmed for the Part 1 `categories` table the same
-- way). RLS remains the real access boundary.

-- ─── search_skills RPC ──────────────────────────────────────────────────
-- Mirrors search_prompts (20260816090111_prompt_review_workflow.sql):
-- security invoker so prompts_select_signed_in's skills equivalent still
-- applies, explicit status = 'approved' filter since RLS alone would let
-- an admin/author's non-approved rows leak into this public search surface.
create or replace function public.search_skills(
  p_category_id uuid default null,
  p_tags text[] default null,
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns setof public.skills as $$
  select s.*
  from public.skills s
  where s.status = 'approved'
    and (p_category_id is null or s.category_id = p_category_id)
    and (
      p_tags is null or array_length(p_tags, 1) is null or exists (
        select 1 from public.skill_tags st
        join public.tags t on t.id = st.tag_id
        where st.skill_id = s.id and t.slug = any(p_tags)
      )
    )
    and (
      p_query is null or p_query = '' or
      to_tsvector('english', s.title || ' ' || s.description || ' ' || s.instructions_body)
        @@ websearch_to_tsquery('english', p_query)
      or s.title ilike '%' || p_query || '%'
    )
  order by s.created_at desc, s.id
  limit p_limit offset p_offset;
$$ language sql stable security invoker set search_path = public;

-- ─── starter categories ──────────────────────────────────────────────
insert into public.categories (resource_type, key, label, color, sort_order) values
  ('skill', 'automation', 'Automation', 'var(--cat-new-app)', 1),
  ('skill', 'data_analysis', 'Data Analysis', 'var(--cat-module-feature)', 2),
  ('skill', 'content_creation', 'Content Creation', 'var(--cat-debugging)', 3),
  ('skill', 'dev_tooling', 'Dev Tooling', 'var(--cat-frontend)', 4),
  ('skill', 'research_docs', 'Research / Docs', 'var(--cat-backend)', 5),
  ('skill', 'ops_infra', 'Ops / Infra', '#e0a03d', 6);
