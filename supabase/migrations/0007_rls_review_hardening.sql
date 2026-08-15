-- DevAtlas — Phase 1: fixes from a `supabase review` pass.
--
-- 1) Performance (auth_rls_initplan advisor, 6 policies): `auth.uid()` and
--    `is_admin(auth.uid())` were called unwrapped in RLS USING/WITH CHECK
--    clauses, so Postgres re-evaluates them per row instead of once per
--    statement. Wrapping in `(select ...)` lets the planner treat it as a
--    stable subquery — same semantics, evaluated once. See
--    https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- 2) Performance (multiple_permissive_policies advisor): prompt_tags had
--    two permissive SELECT policies for `authenticated` —
--    prompt_tags_select_signed_in (unconditional true) and the SELECT arm
--    of prompt_tags_write_owner_or_admin's `for all`. Since permissive
--    policies OR together and the first already allows everything, the
--    second's SELECT arm never added a restriction — just extra
--    evaluation cost on every read. Split the ALL policy into
--    insert/update/delete only.
--
-- 3) Security hardening: profiles_update_own, prompts_insert_own,
--    prompts_update_owner_or_admin, and prompts_delete_owner_or_admin ran
--    `to public` (i.e. every role, including anon) rather than
--    `to authenticated`. In practice anon was already rejected because
--    auth.uid() is null for unauthenticated requests and null never
--    equals a real id, but relying on that implicitly isn't the
--    recommended pattern (see the supabase skill's RLS checklist) — an
--    explicit `to authenticated` makes the boundary an enforced role
--    check, not an incidental side effect of a null comparison, and skips
--    evaluating the policy for anon requests entirely.
--
-- 4) profiles_update_own had no WITH CHECK. The primary-key constraint on
--    id already blocks reassigning a row's id to an existing other user's
--    id, and the prevent_role_self_escalation trigger (0001_init.sql)
--    already blocks a role change via this same UPDATE — so this isn't
--    closing a live gap, but the RLS checklist calls for USING + WITH
--    CHECK together on every UPDATE policy, and doing so here means any
--    future column added to profiles is covered by this predicate too
--    without depending on a trigger someone has to remember to write.

alter policy "profiles_update_own" on public.profiles
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "prompts_select_signed_in" on public.prompts
  using (is_published or author_id = (select auth.uid()));

alter policy "prompts_insert_own" on public.prompts
  to authenticated
  with check ((select auth.uid()) = author_id);

alter policy "prompts_update_owner_or_admin" on public.prompts
  to authenticated
  using ((select auth.uid()) = author_id or is_admin((select auth.uid())));

alter policy "prompts_delete_owner_or_admin" on public.prompts
  to authenticated
  using ((select auth.uid()) = author_id or is_admin((select auth.uid())));

drop policy "prompt_tags_write_owner_or_admin" on public.prompt_tags;

create policy "prompt_tags_insert_owner_or_admin" on public.prompt_tags
  for insert to authenticated
  with check (
    exists (
      select 1 from public.prompts pr
      where pr.id = prompt_tags.prompt_id
        and (pr.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

create policy "prompt_tags_update_owner_or_admin" on public.prompt_tags
  for update to authenticated
  using (
    exists (
      select 1 from public.prompts pr
      where pr.id = prompt_tags.prompt_id
        and (pr.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  )
  with check (
    exists (
      select 1 from public.prompts pr
      where pr.id = prompt_tags.prompt_id
        and (pr.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

create policy "prompt_tags_delete_owner_or_admin" on public.prompt_tags
  for delete to authenticated
  using (
    exists (
      select 1 from public.prompts pr
      where pr.id = prompt_tags.prompt_id
        and (pr.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );
