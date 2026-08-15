-- DevAtlas — Phase 1: fix RLS/grant gaps found in a Supabase security review
--
-- 1) `auth.role() = 'authenticated'` only checks the Postgres execution
--    role. Anonymous-sign-in sessions (if ever enabled on this project)
--    also carry the `authenticated` Postgres role, so this check silently
--    passes for them too — it does not prove the caller has a real
--    account. Replace with the `to authenticated` policy clause, which is
--    enforced by role membership rather than a runtime predicate and does
--    not have this failure mode.
-- 2) `is_admin()` is SECURITY DEFINER and lives in the exposed `public`
--    schema. Postgres grants EXECUTE to PUBLIC on new functions by
--    default, so without an explicit revoke, unauthenticated (anon)
--    callers could invoke it directly via `rpc('is_admin', ...)` to
--    enumerate which user ids are admins, bypassing the profiles RLS it
--    was written to sit behind. Restrict execute to `authenticated`.

-- ─── profiles ────────────────────────────────────────────────────────
drop policy "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select to authenticated using (true);

-- ─── prompts ─────────────────────────────────────────────────────────
drop policy "prompts_select_signed_in" on public.prompts;
create policy "prompts_select_signed_in" on public.prompts
  for select to authenticated using (
    is_published or author_id = auth.uid()
  );

-- ─── tags ────────────────────────────────────────────────────────────
drop policy "tags_select_signed_in" on public.tags;
create policy "tags_select_signed_in" on public.tags
  for select to authenticated using (true);

drop policy "tags_insert_signed_in" on public.tags;
create policy "tags_insert_signed_in" on public.tags
  for insert to authenticated with check (true);

-- ─── prompt_tags ─────────────────────────────────────────────────────
drop policy "prompt_tags_select_signed_in" on public.prompt_tags;
create policy "prompt_tags_select_signed_in" on public.prompt_tags
  for select to authenticated using (true);

-- ─── is_admin(): stop unauthenticated callers from invoking it directly ──
revoke execute on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;
