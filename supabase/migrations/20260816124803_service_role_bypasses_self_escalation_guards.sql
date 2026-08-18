-- DevAtlas — service_role exemption for the two self-escalation guard
-- triggers (prevent_role_self_escalation, 20260815025500_rls.sql; guard_prompt_review_state,
-- 20260816090111_prompt_review_workflow.sql).
--
-- Real bug, found via a full local E2E run of the prompt review workflow
-- (npm run test:e2e): "promoting that account to admin lifts the denial"
-- reported no error, but the target account's role silently stayed
-- 'user' — the exact scenario prevent_role_self_escalation exists to
-- guard against (auth.uid() is null for a service_role-authenticated
-- request, same as for any anonymous/backend call, so
-- `not is_admin(auth.uid())` is true and the trigger reverts the column),
-- except this was the app's own *documented* method for creating the
-- first admin (README's setup instructions; this file's own top comment),
-- not an attack. Confirmed directly against the local stack:
-- `select role from profiles where email = ...` after the "promotion"
-- still showed 'user'.
--
-- The natural first fix attempt — exempting when `session_user =
-- 'service_role'` — doesn't work: PostgREST's whole request pool connects
-- as a single fixed login role (`authenticator`; confirmed via a
-- temporary debug RPC: `session_user` was `authenticator` regardless of
-- API key used), then does `SET LOCAL ROLE <target>` per request, which
-- changes `current_user`, not `session_user` — Postgres's session_user
-- never changes after login regardless of SET ROLE. And `current_user`
-- itself is unusable here for the opposite reason: both trigger functions
-- are (and must stay) SECURITY DEFINER, which pins current_user to the
-- function's owner for the duration of the call, masking whatever
-- PostgREST set it to. The one signal that survives both a fixed
-- session_user and a SECURITY DEFINER current_user override is the JWT
-- claims GUC itself (`request.jwt.claims`), which PostgREST sets from the
-- caller's API key every request, independent of role machinery —
-- confirmed via the same debug RPC returning
-- `{"jwt_role":"service_role"}` correctly even from inside a SECURITY
-- DEFINER call.
--
-- Same reasoning 20260816112643_grant_service_role_table_privileges.sql already
-- established for table grants applies here: service_role is Supabase's
-- trusted backend role, explicitly meant to bypass exactly this kind of
-- customer-facing restriction, protected by requiring the secret key
-- (never exposed to the browser) rather than by these triggers. A regular
-- `authenticated` caller — the actual threat prevent_role_self_escalation
-- defends against — still has no `request.jwt.claims->>'role'` value of
-- 'service_role' no matter what they send, so this doesn't weaken that
-- protection at all.

create or replace function public.prevent_role_self_escalation()
returns trigger as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin(auth.uid())
     and coalesce((current_setting('request.jwt.claims', true))::json->>'role', '') <> 'service_role' then
    new.role := old.role;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

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
