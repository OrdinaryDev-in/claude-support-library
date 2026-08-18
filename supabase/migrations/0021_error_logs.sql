-- DevAtlas — Phase 1: structured, DB-backed error logging.
--
-- PRODUCTION_CHECKLIST.md's "add real error tracking" item explicitly
-- deferred a third-party service (Sentry) for launch. This is the
-- zero-dependency floor in the meantime: errors that already reach
-- safeActionError() (lib/errors.ts, every Server Action) and the App
-- Router error boundaries (app/error.tsx, app/global-error.tsx) also get
-- persisted here, so they're queryable after the fact instead of only
-- existing for as long as the hosting platform's function logs retain
-- them. Swap for Sentry.captureException() later without losing this —
-- they're not mutually exclusive.
--
-- Insert-only for anon/authenticated: errors can happen before a user is
-- signed in (e.g. the login page itself throwing), so this is the one
-- table in this schema anon legitimately needs write access to (see
-- 0012_grant_authenticated_table_privileges.sql's comment on why anon is
-- otherwise deliberately untouched). No update/delete policy for anyone
-- but service_role (via its default-privileges grant, 0013) — logs are
-- append-only from the app's perspective. Only admins can read, since
-- `message`/`path` can incidentally contain request-shaped details not
-- meant for a general signed-in user.

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Which safeActionError() call site or client boundary this came from
  -- (e.g. "createPrompt", "app/error.tsx") — not free-form request data.
  context text not null,
  message text not null,
  -- Next.js's error-boundary digest (error.tsx/global-error.tsx), when
  -- available — lets a report be correlated with the platform's own
  -- function logs for the same incident.
  digest text,
  path text,
  -- Deliberately not FK-validated against auth.uid() by a trigger the way
  -- profiles.role is (0002_rls.sql) — the WITH CHECK below is enough here
  -- since this is a log, not an authorization-bearing column.
  user_id uuid references public.profiles(id) on delete set null
);

create index error_logs_created_at_idx on public.error_logs(created_at desc);

alter table public.error_logs enable row level security;

-- A caller can only tag a row with their own uid (or none) — without
-- this, any authenticated caller could insert log rows framed as another
-- user's via a direct PostgREST call.
create policy error_logs_insert_own on public.error_logs
  for insert
  to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

create policy error_logs_select_admin on public.error_logs
  for select
  to authenticated
  using (is_admin((select auth.uid())));

-- authenticated/service_role already get insert+select on every table,
-- including this new one, via 0019/0013's `alter default privileges`.
-- anon has no such default (0012 deliberately left it out — every other
-- table's RLS requires `authenticated`) — grant it explicitly here since
-- this is the one table anon is actually meant to write to.
grant usage on schema public to anon;
grant insert on public.error_logs to anon;
