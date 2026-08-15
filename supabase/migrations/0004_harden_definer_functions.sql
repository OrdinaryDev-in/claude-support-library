-- DevAtlas — Phase 1: close the remaining WARN-level findings from
-- `supabase db advisors --type security` (see the new pre-push security
-- gate in scripts/check-supabase-security.sh).
--
-- 1) `set_updated_at` has no `search_path` pinned, so a role that can
--    change its own session `search_path` could shadow `now()` with a
--    same-named object earlier in the path. It only calls the built-in
--    `now()`, which lives in pg_catalog — always implicitly searched
--    regardless of search_path — so pinning to '' is safe and removes
--    the mutable-search-path warning with no behavior change.
-- 2) `handle_new_user`, `prevent_role_self_escalation`, and
--    `rls_auto_enable` are SECURITY DEFINER functions that only exist to
--    back a trigger (on auth.users insert, on profiles update) or an
--    event trigger (ddl_command_end) respectively. Triggers and event
--    triggers invoke their function directly, independent of EXECUTE
--    grants — those grants only matter for direct callers (e.g. via
--    PostgREST `rpc/...`). None of these three are meant to be called
--    that way, so revoke PUBLIC's default EXECUTE grant.
--
-- Note: `is_admin(uuid)` is deliberately NOT touched further here — its
-- `authenticated` EXECUTE grant (added in 0003) is required for RLS
-- policies to call it on behalf of signed-in users, so the advisor's
-- "authenticated can execute" WARN for it is an accepted, documented
-- residual finding, not a bug.

alter function public.set_updated_at() set search_path = '';

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_role_self_escalation() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
