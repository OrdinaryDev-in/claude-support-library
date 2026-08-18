-- DevAtlas — block forged review-audit fields on prompt INSERT
--
-- guard_prompt_review_state() (20260816090111_prompt_review_workflow.sql, refreshed
-- in 20260816124803_service_role_bypasses_self_escalation_guards.sql) only runs
-- `before update` — it pins status/reviewed_by/reviewed_at/rejection_reason
-- against a non-admin's UPDATE, but has nothing to say about INSERT.
-- prompts_insert_own's WITH CHECK only constrained author_id and status,
-- leaving reviewed_by/reviewed_at/rejection_reason fully caller-controlled
-- on a fresh row: a non-admin author could set reviewed_by to an admin's
-- id, backdate reviewed_at, or attach a rejection_reason on their own
-- still-pending prompt, forging a review audit trail no admin ever wrote.
--
-- app/actions/prompts.ts's createPrompt() happens not to pass these
-- columns through today, so the app itself doesn't exploit this — but RLS
-- is the actual security boundary (the anon/publishable key is
-- client-exposed), not which columns a current server action happens to
-- send, so a direct `supabase.from('prompts').insert(...)` call could
-- still set them. Unlike UPDATE, INSERT has no OLD row to diff against, so
-- WITH CHECK (not a BEFORE INSERT trigger) is the right tool here: just
-- require these fields to be unset for anyone who isn't admin/service_role,
-- mirroring the values guard_prompt_review_state() already forces for a
-- fresh pending_review row on the UPDATE path.
alter policy "prompts_insert_own" on public.prompts
  with check (
    (select auth.uid()) = author_id
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
