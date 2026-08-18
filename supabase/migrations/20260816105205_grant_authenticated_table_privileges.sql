-- DevAtlas — explicit table-level grants for `authenticated`
--
-- Real bug, found via E2E: "owner can create a prompt" failed with
-- `permission denied for table prompts` (SQLSTATE 42501) on a fresh
-- local `supabase start` + `db reset` stack, even though the
-- prompts_insert_own RLS policy (20260815025500_rls.sql) clearly allows it. RLS
-- policies only restrict *which rows* a role can touch — the role still
-- needs the underlying SQL-level table privilege (GRANT SELECT/INSERT/
-- etc.) before RLS is even evaluated. No migration here has ever granted
-- that; the app has been working purely because Supabase's hosted
-- platform applies its own default project-level grants automatically at
-- project creation (confirmed via `information_schema.role_table_grants`
-- on the linked remote project — authenticated already has full CRUD
-- there). A local CLI-managed stack, built from nothing but these
-- committed migrations, never got that implicit platform step, so it's
-- missing entirely there — same migrations, different resulting
-- privileges, purely because of an un-migrated, environment-specific
-- default. Making it explicit here is also just correct practice
-- (principle of least privilege, supabase-postgres-best-practices skill's
-- security-privileges.md): every grant should be visible in migration
-- history, not implied by whichever platform happened to create the
-- project.
--
-- Scoped to exactly what each table's existing RLS policies need for
-- `authenticated` (see 20260815025500_rls.sql) — nothing broader:
--   profiles:    select (profiles_select_all), update (profiles_update_own)
--                — no insert (handle_new_user() is SECURITY DEFINER and
--                inserts on signup; no policy allows a client-side
--                insert), no delete (no policy allows it)
--   prompts:     select/insert/update/delete (one policy each)
--   tags:        select, insert — no update/delete (no such policies;
--                admin cleanup happens via the SQL editor/service role)
--   prompt_tags: select/insert/update/delete ("for all" write policy)
--
-- Deliberately not touching `anon` here: every policy on every one of
-- these tables requires auth.role() = 'authenticated', so anon can never
-- pass RLS regardless of table grants — anon already has no real access,
-- and revoking its (currently harmless, RLS-blocked) grants on the
-- linked remote project is a separate, more invasive hardening step this
-- fix isn't the place for.
grant usage on schema public to authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.prompts to authenticated;
grant select, insert on public.tags to authenticated;
grant select, insert, update, delete on public.prompt_tags to authenticated;
