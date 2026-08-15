-- DevAtlas — Phase 1: 0003 revoked EXECUTE on public.is_admin(uuid) from
-- the `public` pseudo-role, on the assumption that anon/authenticated's
-- ability to call it came only from PUBLIC's implicit grant. It doesn't:
-- this Supabase project applies default privileges that grant EXECUTE to
-- `anon` explicitly on every new public-schema function, which is a
-- separate ACL entry `revoke ... from public` does not touch. Confirmed
-- via `select proacl from pg_proc where proname = 'is_admin'` — `anon`
-- still held an explicit grant after 0003 — and by
-- `supabase db advisors --type security`, which kept flagging
-- `anon_security_definer_function_executable` on is_admin after 0003 and
-- 0004 both ran.
--
-- `authenticated` keeps EXECUTE (RLS policies call is_admin() on behalf
-- of signed-in users); `anon` gets it revoked explicitly by name.

revoke execute on function public.is_admin(uuid) from anon;
