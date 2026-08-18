-- DevAtlas — future-proof table grants for `authenticated`
--
-- 20260816105205_grant_authenticated_table_privileges.sql granted `authenticated`
-- privileges per-table, explicitly, scoped to exactly what each table's
-- existing RLS policies needed at the time. 20260816112643_grant_service_role_table_privileges.sql
-- fixed the identical class of bug for `service_role` but generalized it
-- with `alter default privileges ... to service_role`, specifically so it
-- wouldn't keep recurring "one newly-discovered table at a time" as the
-- schema grows (0013's own words) — a future migration that adds a table
-- gets service_role's grant automatically. That generalization was never
-- applied to `authenticated`, the role every RLS policy in this schema is
-- actually written for: a future table gets service_role's grant for
-- free but silently has no `authenticated` grant at all until someone
-- remembers to add one, reintroducing the exact bug 0012 (and its
-- `service_role` counterpart) had to hotfix.
--
-- Safe to grant broadly here for the same reason 0012 already grants
-- select/insert/update/delete on every existing app table: RLS is the
-- real access boundary. A table-level grant with no matching row still
-- lets zero rows through as long as RLS is enabled on the new table (the
-- same thing a developer must already remember to do, and the same thing
-- scripts/check-supabase-security.sh's advisor gate already catches if
-- forgotten) — granting the privilege up front doesn't widen what's
-- actually reachable, only what a *future*, correctly-RLS'd table can do
-- without a follow-up grants migration.
--
-- `usage on schema public` doesn't have a default-privileges equivalent
-- (schema usage isn't a per-object grant) and was already granted
-- unconditionally in 0012, so nothing more is needed there.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
