-- DevAtlas — Phase 1: Row Level Security
-- Owner-only-edit + admin-override, applied as a template that future
-- resource-type tables (skills, connectors) can copy with the table name
-- substituted.

alter table public.profiles enable row level security;
alter table public.prompts enable row level security;
alter table public.tags enable row level security;
alter table public.prompt_tags enable row level security;

-- ─── profiles ────────────────────────────────────────────────────────
-- Any signed-in user can read all profiles (needed to show "by <author>"
-- on cards and the NavBar avatar); a user can only update their own row.
create policy "profiles_select_all" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ─── prompts ─────────────────────────────────────────────────────────
-- select: any signed-in user sees published prompts; authors also see
-- their own unpublished drafts.
create policy "prompts_select_signed_in" on public.prompts
  for select using (
    auth.role() = 'authenticated'
    and (is_published or author_id = auth.uid())
  );

create policy "prompts_insert_own" on public.prompts
  for insert with check (auth.uid() = author_id);

create policy "prompts_update_owner_or_admin" on public.prompts
  for update using (
    auth.uid() = author_id or public.is_admin(auth.uid())
  );

create policy "prompts_delete_owner_or_admin" on public.prompts
  for delete using (
    auth.uid() = author_id or public.is_admin(auth.uid())
  );

-- ─── tags ────────────────────────────────────────────────────────────
-- Shared vocabulary: any signed-in user can read/create tags; no
-- update/delete via the app (admin does cleanup via SQL editor).
create policy "tags_select_signed_in" on public.tags
  for select using (auth.role() = 'authenticated');

create policy "tags_insert_signed_in" on public.tags
  for insert with check (auth.role() = 'authenticated');

-- ─── prompt_tags ─────────────────────────────────────────────────────
-- Readable by any signed-in user; writes gated on ownership/admin of the
-- parent prompt.
create policy "prompt_tags_select_signed_in" on public.prompt_tags
  for select using (auth.role() = 'authenticated');

create policy "prompt_tags_write_owner_or_admin" on public.prompt_tags
  for all using (
    exists (
      select 1 from public.prompts pr
      where pr.id = prompt_id
        and (pr.author_id = auth.uid() or public.is_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.prompts pr
      where pr.id = prompt_id
        and (pr.author_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );
