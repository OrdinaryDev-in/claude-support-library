-- DevAtlas — explicit table-level grants for `service_role`
--
-- Same underlying gap as 0012, now hit for a different role: E2E's
-- "promoting that account to admin" step uses SUPABASE_SERVICE_ROLE_KEY
-- to update profiles.role directly (the programmatic equivalent of the
-- SQL editor step README's setup instructions describe — there's no
-- self-serve promotion UI), and failed with:
--
--   permission denied for table profiles (SQLSTATE 42501)
--   hint: GRANT SELECT, UPDATE ON public.profiles TO service_role;
--
-- Checked the linked remote project directly
-- (information_schema.role_table_grants): service_role already has full
-- CRUD (select/insert/update/delete) on every app table there — same
-- story as 0012's authenticated gap, just for service_role this time.
-- Supabase's hosted platform grants this automatically at project
-- creation; a local `supabase start` + `db reset`, built from nothing
-- but this repo's committed migrations, never got it, because it was
-- never actually written down anywhere in migration history.
--
-- Unlike 0012 (authenticated, scoped narrowly to exactly what each
-- table's RLS policies allow, per the principle of least privilege),
-- service_role is intentionally the odd one out: it's Postgres's/
-- Supabase's own trusted backend role, explicitly designed to bypass RLS
-- entirely for admin/backend operations — protected by requiring the
-- secret service-role key, never exposed to the browser, not a
-- customer-facing app role least-privilege applies to the same way.
-- Restoring its full, intended access here, not scoping it down.
--
-- Also sets default privileges for *future* public-schema tables, so
-- this doesn't keep recurring one newly-discovered table at a time as
-- the schema grows (which is exactly how both this and 0012 were
-- found — a real operation failing for the first time against a table
-- that had simply never been exercised end-to-end before).
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant all privileges on functions to service_role;
