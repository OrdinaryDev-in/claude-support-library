-- guard_prompt_review_state still showed up in the anon/authenticated
-- SECURITY DEFINER advisor after the prior revoke — pg_proc.proacl showed
-- why: `revoke ... from anon, authenticated` was a no-op because those
-- roles never had an explicit grant here, they were inheriting EXECUTE
-- through the implicit `PUBLIC` grant every new function gets at create
-- time (visible as the `=X/postgres` ACL entry). Same root cause 0003's
-- comment (see 0005_revoke_is_admin_anon_execute.sql) called out for
-- is_admin. Revoking from PUBLIC directly is what actually removes it.
revoke execute on function public.guard_prompt_review_state() from public;
