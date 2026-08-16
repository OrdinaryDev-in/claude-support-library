-- DevAtlas — protect profiles.email from self-edit
--
-- Same shape of gap prevent_role_self_escalation (0002_rls.sql) closed for
-- `role`, just never applied to `email`: profiles_update_own's WITH CHECK
-- (0007_rls_review_hardening.sql) only pins `auth.uid() = id` — it can't
-- tell which *columns* changed, so nothing stops a signed-in user from
-- calling `update profiles set email = '...' where id = auth.uid()`
-- directly via PostgREST, bypassing the app UI (ProfileForm.tsx renders
-- email as a disabled input; there's no update path for it in
-- app/actions/profile.ts) entirely.
--
-- This matters beyond cosmetic drift from auth.users.email: the review
-- queue displays this exact column as the submitter's identity —
-- `profiles!prompts_author_id_fkey(full_name, email)` in
-- lib/data/prompts.ts's listReviewQueue(), rendered in
-- components/admin/ReviewDetail.tsx and ReviewQueueTable.tsx as
-- "Submitted by {author.full_name || author.email}". An author with no
-- full_name set could set email to something that reads as a trusted
-- identity to the admin reviewer.
--
-- Same trigger pattern as prevent_role_self_escalation, with the same
-- admin + service_role bypass 0014_service_role_bypasses_self_escalation_guards.sql
-- already established is needed (handle_new_user, the only other writer of
-- this column, is an INSERT trigger and is unaffected — this only guards
-- UPDATE).
create or replace function public.prevent_email_self_edit()
returns trigger as $$
begin
  if new.email is distinct from old.email
     and not public.is_admin((select auth.uid()))
     and coalesce((current_setting('request.jwt.claims', true))::json->>'role', '') <> 'service_role' then
    new.email := old.email;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger profiles_prevent_email_self_edit
  before update on public.profiles
  for each row execute procedure public.prevent_email_self_edit();
