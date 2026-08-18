-- DevAtlas — close two WARN-level findings from `supabase db advisors
-- --type security`, same shape 20260815030924_harden_definer_functions.sql and
-- 20260816090327_revoke_guard_prompt_review_state_public_execute.sql already closed
-- for their sibling trigger functions, just never applied to these two
-- newer ones (20260818110000_protect_profile_email_self_edit.sql,
-- 20260818110200_reset_review_on_tag_change.sql):
--
-- `prevent_email_self_edit()` and `reset_prompt_review_on_tag_change()`
-- are SECURITY DEFINER functions that only exist to back a trigger (on
-- profiles update, prompt_tags insert/update/delete respectively).
-- Triggers invoke their function directly, independent of EXECUTE grants
-- — those grants only matter for a direct caller (e.g. via PostgREST
-- `rpc/prevent_email_self_edit`). Neither is meant to be called that
-- way, so revoke PUBLIC's default EXECUTE grant, same as 0004/0011 did.

revoke execute on function public.prevent_email_self_edit() from public, anon, authenticated;
revoke execute on function public.reset_prompt_review_on_tag_change() from public, anon, authenticated;
