-- DevAtlas — Phase 2: Prompt review workflow
-- Replaces the direct-publish flow (is_published defaulting to true, live
-- immediately on insert) with a moderation queue: every new submission
-- starts pending_review and only becomes visible to other users once an
-- admin approves it. Supersedes the is_published-based scheme from
-- 0001_init.sql.

create type prompt_status as enum ('pending_review', 'approved', 'rejected');

alter table public.prompts
  add column status prompt_status not null default 'pending_review',
  add column reviewed_by uuid references public.profiles(id) on delete set null,
  add column reviewed_at timestamptz,
  add column rejection_reason text;

-- Backfill: every existing row was is_published = true (there was never a
-- draft/unpublished path in the app), so treat all of them as already
-- reviewed and approved rather than retroactively hiding live content.
update public.prompts set status = 'approved', reviewed_at = now();

-- ─── RLS: visibility + insert ──────────────────────────────────────────
-- Must run before is_published is dropped below — the current
-- prompts_select_signed_in policy still references it.
alter policy "prompts_select_signed_in" on public.prompts
  using (
    status = 'approved'
    or author_id = (select auth.uid())
    or is_admin((select auth.uid()))
  );

alter policy "prompts_insert_own" on public.prompts
  with check (
    (select auth.uid()) = author_id
    and (status = 'pending_review' or is_admin((select auth.uid())))
  );

alter table public.prompts
  drop column is_published,
  add constraint prompts_rejection_reason_required
    check (status <> 'rejected' or rejection_reason is not null);

create index prompts_status_idx on public.prompts(status);

-- ─── review-state guard trigger ───────────────────────────────────────
-- Same pattern as prevent_role_self_escalation (0002_rls.sql): RLS's
-- USING/WITH CHECK can't tell which columns changed, so a BEFORE UPDATE
-- trigger is what actually pins status/reviewed_* against self-approval.
-- It also implements auto-resubmission: editing the content of an
-- already-reviewed prompt drops it back to pending_review so nothing
-- live/rejected can carry unreviewed edits.
create or replace function public.guard_prompt_review_state()
returns trigger as $$
begin
  if public.is_admin((select auth.uid())) then
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
      new.category is distinct from old.category or
      new.base_instructions is distinct from old.base_instructions or
      new.fill_in_details_guidance is distinct from old.fill_in_details_guidance or
      new.reference_projects_guidance is distinct from old.reference_projects_guidance or
      new.reference_links_guidance is distinct from old.reference_links_guidance or
      new.expected_output_notes is distinct from old.expected_output_notes
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

create trigger prompts_guard_review_state
  before update on public.prompts
  for each row execute procedure public.guard_prompt_review_state();

-- ─── search_prompts RPC: explicit approved-only filter ─────────────────
-- RLS alone is no longer sufficient here: admins and authors can now see
-- non-approved rows via RLS, which would otherwise leak pending/rejected
-- prompts into the public Browse grid for them. This RPC is the public
-- browse/search surface, so it always filters to approved regardless of
-- who's calling; pending/rejected prompts surface separately via the
-- review queue and "My Submissions".
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
  where p.status = 'approved'
    and (p_category is null or p.category = p_category)
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
