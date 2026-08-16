-- DevAtlas — fixes from a `get_advisors` pass on prompt_review_workflow.
--
-- 1) guard_prompt_review_state is a SECURITY DEFINER trigger function; like
--    every new function in public it got EXECUTE granted to PUBLIC by
--    default, making it callable directly via
--    /rest/v1/rpc/guard_prompt_review_state by anon/authenticated even
--    though it's only meant to fire as a BEFORE UPDATE trigger. Same class
--    of issue 0005_revoke_is_admin_anon_execute.sql already fixed once —
--    revoke direct RPC access; the trigger mechanism itself is unaffected
--    since triggers invoke the function by OID, not through role grants.
--
-- 2) unindexed_foreign_keys advisor: prompts_reviewed_by_fkey had no
--    covering index (author_id already has one from 0001_init.sql).

revoke execute on function public.guard_prompt_review_state() from anon, authenticated;

create index prompts_reviewed_by_idx on public.prompts(reviewed_by);
