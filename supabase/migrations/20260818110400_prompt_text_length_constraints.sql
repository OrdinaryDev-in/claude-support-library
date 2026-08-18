-- DevAtlas — Phase 1: DB-level backstop for free-text column lengths.
--
-- lib/validation/prompt-schema.ts (zod) already enforces title <= 140 and
-- description <= 300 on both client and server, and app/actions/review.ts's
-- rejectSchema enforces rejection_reason <= 500 — but zod only runs inside
-- this app's own Server Actions. Anything that calls PostgREST directly
-- with a valid anon/authenticated key (a bypassed client, a bug in a
-- future code path, a compromised session replaying raw requests) skips
-- zod entirely and hits Postgres with no length backstop at all. These
-- CHECK constraints make that path fail too, not just the one this app's
-- UI happens to go through.
--
-- The five template-section columns (base_instructions etc.) had no zod
-- max either — only a `.min(1)` — so this migration adds one there too
-- (20,000 chars: generous enough for a genuinely long template, not
-- unbounded). lib/validation/prompt-schema.ts is updated in the same
-- change to match, so a form submission that would violate this never
-- reaches the database to find out — the constraint is the backstop, not
-- the primary UX.

alter table public.prompts
  add constraint prompts_title_length check (char_length(title) <= 140),
  add constraint prompts_description_length check (char_length(description) <= 300),
  add constraint prompts_base_instructions_length check (char_length(base_instructions) <= 20000),
  add constraint prompts_fill_in_details_guidance_length check (char_length(fill_in_details_guidance) <= 20000),
  add constraint prompts_reference_projects_guidance_length check (char_length(reference_projects_guidance) <= 20000),
  add constraint prompts_reference_links_guidance_length check (char_length(reference_links_guidance) <= 20000),
  add constraint prompts_expected_output_notes_length check (char_length(expected_output_notes) <= 20000),
  add constraint prompts_rejection_reason_length check (char_length(rejection_reason) <= 500);
