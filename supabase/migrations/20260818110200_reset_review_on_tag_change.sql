-- DevAtlas — resubmit for review when a live prompt's tags change
--
-- guard_prompt_review_state()'s auto-resubmission check (0009, refreshed in
-- 0014) only diffs `prompts` content columns (title/description/
-- base_instructions/...). prompt_tags rows are a separate table, gated only
-- by prompt ownership (prompt_tags_insert/update/delete_owner_or_admin,
-- 20260815042229_rls_review_hardening.sql) — not by prompts.status. An author calling
-- updatePrompt with only the tags changed (app/actions/prompts.ts's
-- syncTags deletes and re-inserts prompt_tags rows without touching any
-- `prompts` column) never fires the BEFORE UPDATE trigger on `prompts`, so
-- an already-approved (live, public) prompt can pick up unreviewed tag
-- changes with no re-entry into the review queue — contradicting
-- guard_prompt_review_state's own stated goal (0009's comment: "nothing
-- live/rejected can carry unreviewed edits").
--
-- Fix: an AFTER trigger on prompt_tags that puts the parent prompt back to
-- pending_review, same as an unreviewed content edit would, whenever a
-- non-admin/non-service_role caller inserts/updates/deletes a tag link on
-- an approved/rejected prompt.
--
-- That UPDATE on `prompts` itself fires guard_prompt_review_state() (BEFORE
-- UPDATE), which — for this same non-admin caller — unconditionally resets
-- `new.status := old.status` first and only overrides that back to
-- pending_review if a content column changed (it hasn't; only prompt_tags
-- changed). Left alone, guard_prompt_review_state would silently undo this
-- fix's own UPDATE, since from its perspective a non-admin changing status
-- with no content diff looks exactly like the self-approval attempt it
-- exists to block. A transaction-local flag (set_config's third argument
-- `is_local => true`, auto-cleared at transaction end — the same
-- request.jwt.claims GUC pattern 0014 already relies on for its
-- service_role signal) tells guard_prompt_review_state this particular
-- reset is legitimate, without weakening what it blocks for anyone else.
create or replace function public.guard_prompt_review_state()
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
      new.category is distinct from old.category or
      new.base_instructions is distinct from old.base_instructions or
      new.fill_in_details_guidance is distinct from old.fill_in_details_guidance or
      new.reference_projects_guidance is distinct from old.reference_projects_guidance or
      new.reference_links_guidance is distinct from old.reference_links_guidance or
      new.expected_output_notes is distinct from old.expected_output_notes or
      coalesce(current_setting('app.tag_change_resubmit', true), '') = 'true'
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

-- `(select auth.uid()) is not null` matters as much as the admin/
-- service_role check: supabase/seed/prompts.sql (applied by `supabase db
-- reset`) inserts prompts pre-approved and then inserts their prompt_tags
-- rows in the same script, run as a raw psql/migration session with no
-- request.jwt.claims context at all — auth.uid() is null there, same as
-- it would be for a genuinely unauthenticated caller. The difference is
-- that prompt_tags_insert/update/delete_owner_or_admin (0007) already
-- requires `to authenticated` plus real prompt ownership, so RLS
-- guarantees any request that actually reaches this trigger from the API
-- has a non-null auth.uid() — a null uid here can only mean a trusted
-- migration/seed/superuser session, never a live non-admin author, so
-- it's safe (and necessary, to keep seeding idempotent) to skip the reset
-- in that case.
create or replace function public.reset_prompt_review_on_tag_change()
returns trigger as $$
declare
  target_prompt_id uuid := coalesce(new.prompt_id, old.prompt_id);
  acting_uid uuid := (select auth.uid());
  is_service_role boolean := coalesce((current_setting('request.jwt.claims', true))::json->>'role', '') = 'service_role';
begin
  if acting_uid is not null and not (public.is_admin(acting_uid) or is_service_role) then
    perform set_config('app.tag_change_resubmit', 'true', true);

    update public.prompts
    set status = 'pending_review'
    where id = target_prompt_id
      and status in ('approved', 'rejected');

    perform set_config('app.tag_change_resubmit', '', true);
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create trigger prompt_tags_reset_review_state
  after insert or update or delete on public.prompt_tags
  for each row execute procedure public.reset_prompt_review_on_tag_change();
