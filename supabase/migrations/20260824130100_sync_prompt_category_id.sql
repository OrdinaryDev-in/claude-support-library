-- DevAtlas — fix a self-inflicted gap in 20260824130000_categories.sql
--
-- That migration made prompts.category_id NOT NULL right after backfilling
-- existing rows, but the currently-live app code (not yet updated to Part 2
-- of the categories rollout) only ever inserts `category` (the old enum) —
-- it has no idea category_id exists. Every prompt insert from the still-
-- deployed frontend would start failing the NOT NULL constraint the moment
-- this migration landed. This trigger closes that gap: whenever a row is
-- inserted/updated with category_id left null but category set, derive
-- category_id from it automatically, so old code keeps working unchanged
-- until the app-layer cutover (Part 2) ships and starts setting
-- category_id directly.

create or replace function public.sync_prompt_category_id()
returns trigger as $$
begin
  if new.category_id is null and new.category is not null then
    select id into new.category_id
    from public.categories
    where resource_type = 'prompt' and key = new.category::text;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Not meant to be called directly (only via the trigger) — same reasoning
-- as guard_prompt_review_state()/prevent_role_self_escalation().
revoke execute on function public.sync_prompt_category_id() from public, anon, authenticated;

create trigger prompts_sync_category_id
  before insert or update on public.prompts
  for each row execute procedure public.sync_prompt_category_id();
