-- DevAtlas — Phase 1: Postgres-backed app-layer rate limiting.
--
-- Login/signup themselves bypass our server entirely (AuthForm.tsx calls
-- supabase.auth.signInWithPassword/signUp directly from the browser) —
-- Supabase's own built-in per-IP Auth rate limits cover those (tunable
-- in the dashboard, not here). This covers the surfaces that DO run on
-- our server: app/(auth)/callback/route.ts and mutating server actions
-- (updatePassword, create/update/delete/duplicatePrompt).
--
-- Fixed-window counter in `rate_limits`, keyed by (bucket, identity).
-- RLS is enabled with NO policies — default-deny, unreachable via
-- PostgREST directly by anon or authenticated — the only access path is
-- the SECURITY DEFINER check_rate_limit() function below, following the
-- same explicit-grant hardening pattern as is_admin() (0003/0005).
--
-- check_rate_limit() takes a caller-supplied identity (a user id for
-- authenticated buckets, an IP string for the anonymous callback
-- bucket) rather than deriving it purely from auth.uid(), because the
-- callback route has no session yet when it needs to check. That opens
-- an escalation an anon/authenticated grant alone wouldn't close: any
-- signed-in caller could otherwise pass another user's id directly to
-- this RPC and pollute their rate-limit bucket, and any anonymous
-- caller could target buckets meant only for authenticated users. Two
-- checks close that: authenticated callers may only assert their own
-- auth.uid() as the identity (any bucket); anon callers are restricted
-- to the 'callback' bucket only. An anon caller can still increment
-- another IP's 'callback' bucket by guessing/spoofing that IP string —
-- accepted residual risk (denial-only, no data exposure), inherent to
-- IP-keyed limiting through a public RPC, not a privilege escalation.

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hit_count integer not null default 1,
  primary key (key, window_start)
);

create index rate_limits_key_idx on public.rate_limits(key);

alter table public.rate_limits enable row level security;
-- Deliberately no policies: default-deny for anon and authenticated alike.

create or replace function public.check_rate_limit(
  p_bucket text,
  p_identity text,
  p_max_hits integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_window_start timestamptz;
  v_count integer;
begin
  if auth.role() = 'authenticated' then
    if p_identity is distinct from (select auth.uid())::text then
      raise exception 'identity mismatch';
    end if;
  elsif auth.role() = 'anon' then
    if p_bucket <> 'callback' then
      raise exception 'bucket not permitted for anonymous callers';
    end if;
  else
    raise exception 'unsupported role for check_rate_limit';
  end if;

  v_key := p_bucket || ':' || p_identity;
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  -- Opportunistic cleanup of stale windows on every call — bounded by
  -- the index, avoids depending on pg_cron (may not be enabled on every
  -- plan).
  delete from public.rate_limits
  where key = v_key and window_start < v_window_start - interval '1 hour';

  insert into public.rate_limits (key, window_start, hit_count)
  values (v_key, v_window_start, 1)
  on conflict (key, window_start)
  do update set hit_count = rate_limits.hit_count + 1
  returning hit_count into v_count;

  return v_count <= p_max_hits;
end;
$$;

revoke execute on function public.check_rate_limit(text, text, integer, integer) from public;
-- anon: needed for the unauthenticated /callback route (bucket='callback').
-- authenticated: needed for updatePassword / create-update-delete-duplicatePrompt.
grant execute on function public.check_rate_limit(text, text, integer, integer) to anon, authenticated;
