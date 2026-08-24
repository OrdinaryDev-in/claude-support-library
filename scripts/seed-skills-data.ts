// Source of truth for DevAtlas's starter skills — mirrors
// scripts/seed-data.ts's convention (both scripts/seed-skills.ts and any
// future `supabase db reset` seed script should read from here so they
// never drift). `category` here is the shared `categories` table's `key`
// for resource_type = 'skill' (seeded by
// supabase/migrations/20260824140000_skills.sql), not a Postgres enum —
// scripts/seed-skills.ts resolves it to a category_id at load time.
//
// Tool-agnostic by design (Phase 2's Context decision, plan-phase-2-...md):
// every skill below is written to be usable as-is by any agent/assistant,
// not framed around one vendor's skill-file format.

export interface SeedSkill {
  title: string;
  slug: string;
  description: string;
  category: "automation" | "data_analysis" | "content_creation" | "dev_tooling" | "research_docs" | "ops_infra";
  tags: string[];
  trigger_description: string;
  instructions_body: string;
  required_tools_guidance: string;
  example_usage: string;
  expected_output_notes: string;
}

export const SEED_SKILLS: SeedSkill[] = [
  // ─── automation (2) ────────────────────────────────────────────────
  {
    title: "Triage and Label Incoming Issues",
    slug: "triage-and-label-incoming-issues",
    description: "Read a new bug/feature issue, classify it, and apply consistent labels and a priority.",
    category: "automation",
    tags: ["automation", "github"],
    trigger_description:
      "A new issue or ticket has just been filed and needs to be classified before anyone triages it by hand.",
    instructions_body:
      "Read the issue title and body in full. Determine its type (bug, feature request, question, chore) and severity (blocking, high, normal, low) from the actual content — reported impact, reproducibility, whether it blocks a release — not just keywords. Apply the matching type/priority labels from the project's existing label set (list them first if unknown; never invent new labels). If the issue is missing information needed to act on it (no repro steps for a bug, no acceptance criteria for a feature), add a 'needs-info' label and leave a comment listing exactly what's missing.",
    required_tools_guidance: "Read/list access to the issue tracker; ability to add labels and post a comment.",
    example_usage:
      "Input: an issue titled 'App crashes on login' with a stack trace and repro steps. Output: labeled bug + high, no comment needed since repro steps are present.",
    expected_output_notes:
      "Labels applied match the project's real label set exactly (case included); priority reflects actual impact, not the reporter's own guess; a 'needs-info' comment is specific, not a generic 'please provide more details'.",
  },
  {
    title: "Summarize a Long Meeting Transcript into Action Items",
    slug: "summarize-meeting-transcript-into-action-items",
    description: "Turn a raw meeting transcript into a short summary plus a clean, owned action-item list.",
    category: "automation",
    tags: ["automation", "docs"],
    trigger_description: "A raw transcript (auto-generated or pasted) needs to become something people will actually read.",
    instructions_body:
      "Read the full transcript. Produce: (1) a 3-5 sentence summary of what was decided, not just discussed; (2) a bulleted action-item list, each with an owner (the person who said they'd do it, not a guess) and, if stated, a deadline; (3) open questions that were raised but not resolved. Do not include filler, small talk, or restate the entire discussion — only decisions, commitments, and unresolved threads.",
    required_tools_guidance: "None beyond reading the transcript text — no external tools required.",
    example_usage:
      "Input: a 45-minute standup transcript. Output: a 4-sentence summary, 5 action items each tagged with a name, 2 open questions.",
    expected_output_notes:
      "Every action item has a real owner named in the transcript, not 'someone' or 'the team'; nothing is invented that wasn't actually said.",
  },

  // ─── data_analysis (2) ─────────────────────────────────────────────
  {
    title: "Find the Root Cause of a Metric Drop",
    slug: "find-root-cause-of-metric-drop",
    description: "Given a dashboard showing a metric drop, work backward to the most likely cause with evidence.",
    category: "data_analysis",
    tags: ["analytics", "sql"],
    trigger_description: "A key metric (signups, revenue, latency, error rate) dropped and someone needs to know why before reacting.",
    instructions_body:
      "Confirm the drop is real, not a reporting artifact — check for a data pipeline gap, timezone issue, or definition change first. Segment the metric by the dimensions available (platform, region, cohort, release version) to isolate whether the drop is broad or concentrated in one segment. Cross-reference the drop's timing against recent deploys, config changes, or external events. State the most likely cause as a ranked hypothesis list with the evidence for each, not a single unverified guess.",
    required_tools_guidance: "Query access to the metrics/analytics database; visibility into recent deploy/release history.",
    example_usage:
      "Input: 'Signups dropped 30% starting Tuesday.' Output: confirmed real (not a tracking gap), isolated to iOS only, correlated with an App Store release that broke the signup form — ranked as the top hypothesis with the supporting query result.",
    expected_output_notes:
      "Each hypothesis is backed by a specific number or query result, not intuition; the pipeline/reporting-artifact check happens before any causal claim.",
  },
  {
    title: "Clean and Validate a Messy CSV Export",
    slug: "clean-and-validate-messy-csv-export",
    description: "Take a raw CSV export and produce a clean, typed, validated version plus a list of what was fixed.",
    category: "data_analysis",
    tags: ["data", "python"],
    trigger_description: "A CSV export from an external system or spreadsheet needs to be usable for analysis or import.",
    instructions_body:
      "Load the file and identify: inconsistent date/number formats, duplicate rows, missing required fields, and obviously invalid values (negative ages, out-of-range dates). Normalize formats to a single consistent convention. Flag rows that can't be safely auto-fixed instead of guessing at them. Produce the cleaned file plus a short changelog: how many rows were deduplicated, reformatted, or flagged, with a few examples of each.",
    required_tools_guidance: "File read/write access; a scripting environment capable of tabular data processing (e.g. pandas or equivalent).",
    example_usage:
      "Input: a 5,000-row export with three different date formats and 40 duplicate rows. Output: a cleaned CSV with one date format, duplicates removed, and a changelog noting 40 dedup'd rows and 12 flagged for manual review.",
    expected_output_notes:
      "Nothing ambiguous is silently 'fixed' by guessing — it's flagged instead; the changelog gives concrete counts, not vague language like 'some rows were cleaned'.",
  },

  // ─── content_creation (2) ──────────────────────────────────────────
  {
    title: "Turn Release Notes into a Changelog Post",
    slug: "turn-release-notes-into-changelog-post",
    description: "Convert raw commit/PR titles for a release into a readable, user-facing changelog entry.",
    category: "content_creation",
    tags: ["writing", "product"],
    trigger_description: "A release just shipped and the raw list of merged PRs/commits needs to become something users can read.",
    instructions_body:
      "Group the raw items into categories (New, Improved, Fixed) rather than listing them in merge order. Rewrite each entry in user-facing language — what changed for the user, not the internal implementation detail. Drop purely internal items (refactors, dependency bumps, test-only changes) unless they fix a user-visible issue. Keep each entry to one line where possible.",
    required_tools_guidance: "Read access to the release's PR/commit list and titles; no other tools required.",
    example_usage:
      "Input: 15 raw PR titles including 'fix: null pointer in checkout', 'chore: bump lodash', 'feat: add dark mode'. Output: a 3-item changelog — dark mode under New, the checkout fix under Fixed, the dependency bump omitted.",
    expected_output_notes: "Every entry reads as something a user would care about; internal-only changes are excluded, not just reworded.",
  },
  {
    title: "Write Alt Text for a Batch of Images",
    slug: "write-alt-text-for-batch-of-images",
    description: "Produce accessible, specific alt text for a set of images, not generic filler.",
    category: "content_creation",
    tags: ["accessibility", "writing"],
    trigger_description: "A set of images (blog post, product page, docs) needs alt text before publishing.",
    instructions_body:
      "For each image, describe what's functionally relevant in context — for a decorative image, mark it as decorative (empty alt) rather than describing it; for a chart or diagram, describe the actual data/relationship shown, not just 'a chart'; for a screenshot of UI, describe the state/action being illustrated, not every pixel. Keep each description under ~125 characters where the content allows it.",
    required_tools_guidance: "Image viewing capability, and the surrounding page context each image appears in.",
    example_usage:
      "Input: a bar chart image with no alt text, captioned 'Q3 revenue by region'. Output: alt text reading 'Bar chart: APAC leads Q3 revenue at $2.1M, followed by EMEA at $1.4M' rather than 'A bar chart'.",
    expected_output_notes: "No alt text is a generic 'image of...' placeholder; decorative images are correctly marked empty rather than over-described.",
  },

  // ─── dev_tooling (2) ────────────────────────────────────────────────
  {
    title: "Bisect a Failing Test to Its Introducing Commit",
    slug: "bisect-failing-test-to-introducing-commit",
    description: "Use binary search over commit history to find exactly which commit broke a specific test.",
    category: "dev_tooling",
    tags: ["git", "testing"],
    trigger_description: "A test is failing and it's unclear which of many recent commits introduced the regression.",
    instructions_body:
      "Confirm the test currently fails and identify a known-good commit where it passed. Use a binary search (git bisect or equivalent) rather than checking commits one at a time — run the test at the midpoint commit, mark it good/bad, and narrow the range each iteration. Once the introducing commit is found, read its diff and explain specifically what in that change caused the failure, not just which commit it was.",
    required_tools_guidance: "Shell execution with git access to the repo; ability to run the failing test.",
    example_usage:
      "Input: 'test_checkout_total started failing sometime in the last 40 commits.' Output: bisected to a specific commit in ~6 steps, with the diff showing a rounding change that caused the failure.",
    expected_output_notes: "The actual introducing commit is verified by re-running the test at that exact commit and its parent, not just inferred from the commit message.",
  },
  {
    title: "Generate a Minimal Reproduction for a Bug Report",
    slug: "generate-minimal-reproduction-for-bug-report",
    description: "Strip a bug down to the smallest code/config that still reproduces it, for a clean issue report.",
    category: "dev_tooling",
    tags: ["debugging", "testing"],
    trigger_description: "A bug reproduces in a large codebase and needs to be isolated before filing or debugging further.",
    instructions_body:
      "Starting from the full reproduction, remove code/dependencies/config one piece at a time, re-testing after each removal to confirm the bug still reproduces. Stop once nothing more can be removed without the bug disappearing. Prefer a single file or a small runnable snippet over a full project when the bug allows it. Include the exact steps to trigger the bug and the expected vs. actual behavior.",
    required_tools_guidance: "Shell/code execution to run the reproduction repeatedly; file read/write to create the minimal version.",
    example_usage:
      "Input: a bug that only reproduces in a large Next.js app. Output: a 20-line minimal repo/snippet that reproduces the same bug with no unrelated dependencies.",
    expected_output_notes: "The minimal reproduction is verified to still trigger the bug before being handed off — not just assumed to.",
  },

  // ─── research_docs (2) ─────────────────────────────────────────────
  {
    title: "Compare Two Libraries for a Specific Use Case",
    slug: "compare-two-libraries-for-specific-use-case",
    description: "Produce a decision-ready comparison of two candidate libraries against the actual requirements at hand.",
    category: "research_docs",
    tags: ["research", "docs"],
    trigger_description: "A team needs to pick between two (or more) libraries/tools for a specific, stated need.",
    instructions_body:
      "Start from the actual requirements (not generic 'which is better') — performance needs, bundle size constraints, license, maintenance activity, and the specific features required. Check each library's real docs/changelog rather than relying on general reputation. Produce a comparison table against those specific requirements, then a clear recommendation with the reasoning, not just a feature list with no conclusion.",
    required_tools_guidance: "Web search / doc access to read each library's current documentation and changelog.",
    example_usage:
      "Input: 'Choosing between library A and B for client-side form validation, need small bundle size and TypeScript support.' Output: a table comparing bundle size, TS support, and maintenance activity, ending in a specific recommendation.",
    expected_output_notes: "The recommendation follows from the stated requirements, not from which library is more popular in general.",
  },
  {
    title: "Turn a Design Doc into an Onboarding-Ready README",
    slug: "turn-design-doc-into-onboarding-ready-readme",
    description: "Convert an internal design/RFC doc into a README a new engineer can actually use to get started.",
    category: "research_docs",
    tags: ["docs", "onboarding"],
    trigger_description: "A design doc exists but the project has no README, or its README doesn't reflect how the system actually works.",
    instructions_body:
      "Extract from the design doc: what the system does, how to run it locally, the key architectural decisions (and why, briefly), and where to look for more detail. Drop content that was relevant to the original design discussion but isn't useful to someone starting today (rejected alternatives, open questions since resolved). Verify any setup/run instructions actually work rather than copying them from the doc unverified.",
    required_tools_guidance: "Read access to the design doc and the actual codebase; shell execution to verify setup steps.",
    example_usage:
      "Input: a 12-page RFC for a new service. Output: a README with a 2-paragraph overview, verified setup steps, and a short 'why it's built this way' section.",
    expected_output_notes: "Setup instructions in the output were actually run and confirmed to work, not just transcribed from the source doc.",
  },

  // ─── ops_infra (2) ──────────────────────────────────────────────────
  {
    title: "Diagnose a Failing Deployment",
    slug: "diagnose-a-failing-deployment",
    description: "Work through a failed deploy systematically to find the actual cause, not just retry it.",
    category: "ops_infra",
    tags: ["deployment", "debugging"],
    trigger_description: "A deployment failed or a service won't come up after a deploy, and the cause isn't obvious from the top-level error.",
    instructions_body:
      "Read the actual deploy/build logs in full, not just the last line — the real error is often several lines above a generic 'deploy failed' summary. Check, in order: build/compile errors, missing environment variables/secrets, migration failures, and health-check failures on the new instance. Compare against the last known-good deploy to isolate what changed. State the specific root cause with the log line that proves it, not a generic 'try redeploying'.",
    required_tools_guidance: "Read access to deploy/build logs and the service's environment configuration.",
    example_usage:
      "Input: 'Deploy failed, dashboard just says Error.' Output: root cause identified as a missing new environment variable introduced in the latest commit, quoting the exact log line.",
    expected_output_notes: "The diagnosis points at a specific log line or config diff, not a general troubleshooting checklist handed back to the user.",
  },
  {
    title: "Write a Rollback Plan Before a Risky Migration",
    slug: "write-rollback-plan-before-risky-migration",
    description: "Produce a concrete, tested rollback plan for a database or infra change before it ships.",
    category: "ops_infra",
    tags: ["infra", "postgres"],
    trigger_description: "A migration or infra change carries real risk (data loss, downtime) and needs a rollback plan before it runs.",
    instructions_body:
      "Identify exactly what the change modifies (schema, data, config) and whether each part is reversible. For anything irreversible (a dropped column, a destructive data transform), call that out explicitly rather than writing a rollback step that can't actually work. Write the rollback as concrete commands/steps, not a description — and note what data or state, if any, would be permanently lost if rollback is needed after forward progress (e.g. new rows written post-migration).",
    required_tools_guidance: "Read access to the migration/change definition; write access to draft the rollback script.",
    example_usage:
      "Input: a migration that renames a column and backfills a new one. Output: a rollback script that reverses the rename, plus an explicit note that rows inserted after the migration using the new column name would need manual reconciliation.",
    expected_output_notes: "Irreversible steps are named as irreversible, not glossed over with an rollback step that wouldn't actually restore the prior state.",
  },
];
