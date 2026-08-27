-- DevAtlas — guest (read-only) access
--
-- Lets a visitor browse /library and its prompt/skill/connector detail
-- pages without signing up, via Supabase's built-in anonymous sign-in
-- (supabase.auth.signInAnonymously(), called from lib/supabase/middleware.ts
-- on first unauthenticated visit to a guest-readable route). An anonymous
-- session is a real auth.users row with a real JWT — auth.role() reports
-- 'authenticated', same as any other signed-in user — so every existing
-- `to authenticated` / `auth.role() = 'authenticated'` read policy already
-- covers guests with zero changes. What guests must NOT get is write
-- access: this migration adds an is_anonymous() guard to every write
-- policy that only checked ownership, since auth.uid() = author_id is
-- just as true for a guest's own anonymous row as for a real user's.

-- ─── profiles.email must accept guests ─────────────────────────────────
-- handle_new_user() (20260815025000_init.sql) inserts new.email verbatim
-- on every auth.users insert, anonymous ones included — auth.users.email
-- is null for an anonymous sign-in, so the `not null` constraint here
-- would fail the trigger and the sign-in itself.
alter table public.profiles alter column email drop not null;

-- ─── is_anonymous() helper ──────────────────────────────────────────────
-- Mirrors is_admin(uid) (20260815025000_init.sql) in spirit: a small,
-- reusable predicate every write policy below can call instead of
-- repeating the raw JWT-claim lookup. GoTrue sets `is_anonymous: true` in
-- the JWT for an anonymous session and omits/falses it otherwise, so the
-- coalesce covers both "false" and "claim absent" as "not anonymous". An
-- anonymous sign-in's JWT carries role: authenticated at the Postgres
-- level (RLS/PostgREST route it as `authenticated`, never as the
-- separate `anon` Postgres role, which means "no JWT at all") — so, like
-- is_admin, this only needs to be callable by `authenticated`. See
-- 20260827175720_grant_is_anonymous_authenticated_execute.sql for that
-- grant — it turned out NOT to happen implicitly the way it does for
-- is_admin() on the hosted project this migration was first tested
-- against; a fresh local stack needs it explicit (confirmed by actually
-- running `supabase db reset` + the e2e suite locally, not just against
-- the hosted project).
create or replace function public.is_anonymous()
returns boolean as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$ language sql stable security definer set search_path = public;

revoke execute on function public.is_anonymous() from anon;

-- ─── profiles ────────────────────────────────────────────────────────
alter policy "profiles_update_own" on public.profiles
  using ((select auth.uid()) = id and not public.is_anonymous())
  with check ((select auth.uid()) = id and not public.is_anonymous());

-- ─── prompts ─────────────────────────────────────────────────────────
alter policy "prompts_insert_own" on public.prompts
  with check (
    (select auth.uid()) = author_id
    and not public.is_anonymous()
    and (
      is_admin((select auth.uid()))
      or (
        status = 'pending_review'
        and reviewed_by is null
        and reviewed_at is null
        and rejection_reason is null
      )
    )
  );

alter policy "prompts_update_owner_or_admin" on public.prompts
  using (
    ((select auth.uid()) = author_id and not public.is_anonymous())
    or is_admin((select auth.uid()))
  );

alter policy "prompts_delete_owner_or_admin" on public.prompts
  using (
    ((select auth.uid()) = author_id and not public.is_anonymous())
    or is_admin((select auth.uid()))
  );

-- ─── tags ────────────────────────────────────────────────────────────
alter policy "tags_insert_signed_in" on public.tags
  with check (not public.is_anonymous());

-- ─── prompt_tags ─────────────────────────────────────────────────────
alter policy "prompt_tags_insert_owner_or_admin" on public.prompt_tags
  with check (
    not public.is_anonymous()
    and exists (
      select 1 from public.prompts pr
      where pr.id = prompt_tags.prompt_id
        and (pr.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

alter policy "prompt_tags_update_owner_or_admin" on public.prompt_tags
  using (
    not public.is_anonymous()
    and exists (
      select 1 from public.prompts pr
      where pr.id = prompt_tags.prompt_id
        and (pr.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  )
  with check (
    not public.is_anonymous()
    and exists (
      select 1 from public.prompts pr
      where pr.id = prompt_tags.prompt_id
        and (pr.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

alter policy "prompt_tags_delete_owner_or_admin" on public.prompt_tags
  using (
    not public.is_anonymous()
    and exists (
      select 1 from public.prompts pr
      where pr.id = prompt_tags.prompt_id
        and (pr.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

-- ─── skills / skill_tags ─────────────────────────────────────────────
alter policy "skills_insert_own" on public.skills
  with check (
    (select auth.uid()) = author_id
    and not public.is_anonymous()
    and (
      is_admin((select auth.uid()))
      or (
        status = 'pending_review'
        and reviewed_by is null
        and reviewed_at is null
        and rejection_reason is null
      )
    )
  );

alter policy "skills_update_owner_or_admin" on public.skills
  using (
    ((select auth.uid()) = author_id and not public.is_anonymous())
    or is_admin((select auth.uid()))
  );

alter policy "skills_delete_owner_or_admin" on public.skills
  using (
    ((select auth.uid()) = author_id and not public.is_anonymous())
    or is_admin((select auth.uid()))
  );

alter policy "skill_tags_insert_owner_or_admin" on public.skill_tags
  with check (
    not public.is_anonymous()
    and exists (
      select 1 from public.skills s
      where s.id = skill_tags.skill_id
        and (s.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

alter policy "skill_tags_update_owner_or_admin" on public.skill_tags
  using (
    not public.is_anonymous()
    and exists (
      select 1 from public.skills s
      where s.id = skill_tags.skill_id
        and (s.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  )
  with check (
    not public.is_anonymous()
    and exists (
      select 1 from public.skills s
      where s.id = skill_tags.skill_id
        and (s.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

alter policy "skill_tags_delete_owner_or_admin" on public.skill_tags
  using (
    not public.is_anonymous()
    and exists (
      select 1 from public.skills s
      where s.id = skill_tags.skill_id
        and (s.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

-- ─── connectors / connector_tags ─────────────────────────────────────
alter policy "connectors_insert_own" on public.connectors
  with check (
    (select auth.uid()) = author_id
    and not public.is_anonymous()
    and (
      is_admin((select auth.uid()))
      or (
        status = 'pending_review'
        and reviewed_by is null
        and reviewed_at is null
        and rejection_reason is null
      )
    )
  );

alter policy "connectors_update_owner_or_admin" on public.connectors
  using (
    ((select auth.uid()) = author_id and not public.is_anonymous())
    or is_admin((select auth.uid()))
  );

alter policy "connectors_delete_owner_or_admin" on public.connectors
  using (
    ((select auth.uid()) = author_id and not public.is_anonymous())
    or is_admin((select auth.uid()))
  );

alter policy "connector_tags_insert_owner_or_admin" on public.connector_tags
  with check (
    not public.is_anonymous()
    and exists (
      select 1 from public.connectors c
      where c.id = connector_tags.connector_id
        and (c.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

alter policy "connector_tags_update_owner_or_admin" on public.connector_tags
  using (
    not public.is_anonymous()
    and exists (
      select 1 from public.connectors c
      where c.id = connector_tags.connector_id
        and (c.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  )
  with check (
    not public.is_anonymous()
    and exists (
      select 1 from public.connectors c
      where c.id = connector_tags.connector_id
        and (c.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

alter policy "connector_tags_delete_owner_or_admin" on public.connector_tags
  using (
    not public.is_anonymous()
    and exists (
      select 1 from public.connectors c
      where c.id = connector_tags.connector_id
        and (c.author_id = (select auth.uid()) or is_admin((select auth.uid())))
    )
  );

-- ─── categories ──────────────────────────────────────────────────────
-- Admin-only writes already exclude any guest (is_admin() requires a
-- profiles row with role = 'admin', which no anonymous sign-in can ever
-- have — see prevent_role_self_escalation, 20260815025500_rls.sql), so no
-- is_anonymous() guard is needed here.
