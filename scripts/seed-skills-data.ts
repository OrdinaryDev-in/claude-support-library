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

  // ─── dev_tooling (+3) — from the Phase 2b seed research pass, see
  // plan-phase-2-...md. Each cleared the "reusable pattern, not a one-off
  // task" bar the research applied.
  {
    title: "Triage a Dependency Vulnerability Report",
    slug: "triage-a-dependency-vulnerability-report",
    description: "Scan an SCA/audit report and produce a prioritized, minimal remediation plan — not 'upgrade everything'.",
    category: "dev_tooling",
    tags: ["security", "dependencies"],
    trigger_description: "An npm audit / Dependabot / SCA tool has flagged vulnerabilities and someone needs to know which ones are actually urgent.",
    instructions_body:
      "For each flagged CVE, determine whether the vulnerable code path is actually reachable given how this codebase uses the package — a vulnerability in a function this codebase never calls doesn't need urgent action, even if the package version is technically flagged. Rank by real exploitability, not CVSS score alone. Propose the minimal version bump that resolves each urgent finding, and flag any upgrade that itself carries a breaking-change risk requiring its own testing pass, rather than bundling everything into one large bump.",
    required_tools_guidance: "Read access to the audit report and the codebase's actual usage of each flagged package; ability to check package changelogs.",
    example_usage:
      "Input: an npm audit report with 12 findings. Output: 2 ranked urgent (reachable code path), 7 deferrable (unreachable), 3 requiring a breaking-change-aware upgrade plan of their own.",
    expected_output_notes: "Every ranking is grounded in this codebase's actual usage of the package, not the package's general capability or the CVE's abstract severity score.",
  },
  {
    title: "Quarantine a Flaky Test",
    slug: "quarantine-a-flaky-test",
    description: "Correlate intermittent CI failures across recent runs, then tag/skip the flaky test with a tracking issue.",
    category: "dev_tooling",
    tags: ["testing", "ci"],
    trigger_description: "A test has failed intermittently across multiple recent CI runs and is starting to erode trust in the pipeline.",
    instructions_body:
      "Pull the recent CI run history for the suspect test and confirm it's genuinely flaky (fails intermittently on the same code) rather than a real, consistently-reproducible regression. Identify the likely cause class (timing/race, shared test-order state, external network dependency) without necessarily fixing it in this pass. Quarantine it (skip with a clear marker, not a silent deletion) and open a tracking issue with the failure pattern and suspected cause, so it isn't simply forgotten once it stops blocking CI.",
    required_tools_guidance: "Read access to CI run history/logs across multiple recent runs; write access to skip/tag the test and open an issue.",
    example_usage:
      "Input: a test that failed in 4 of the last 15 CI runs with no code change between passes. Output: quarantined with a `.skip` and a tracking issue noting the likely timing-race cause.",
    expected_output_notes: "The flaky/real-regression distinction is backed by actual multi-run evidence, not a single failure; the tracking issue names a specific suspected cause, not just 'flaky test'.",
  },
  {
    title: "Map an Unfamiliar Subsystem for Onboarding",
    slug: "map-an-unfamiliar-subsystem-for-onboarding",
    description: "Walk one subsystem of a codebase and produce a durable architecture map — entry points, data flow, known debt.",
    category: "dev_tooling",
    tags: ["documentation", "legacy"],
    trigger_description: "Someone (a new hire, or the agent itself) needs to work in an unfamiliar part of a codebase and needs a scoped map before making changes.",
    instructions_body:
      "Scope to one subsystem, not the whole repo — a map that tries to cover everything at once is too broad to actually use. Identify the real entry points (where a request/job/event first enters this part of the code), the core data models and how they relate, and non-obvious conventions specific to this subsystem (naming, error handling, test locations). Note anything that looks like accumulated tech debt, without attempting to fix it. Write the output as a durable doc, not a one-off chat answer.",
    required_tools_guidance: "Read access to the codebase; write access to save the resulting doc.",
    example_usage:
      "Input: 'Map the billing module before I add a proration feature.' Output: an ARCHITECTURE.md section covering the module's entry points, its Invoice/LineItem data model, and a flagged inconsistency in how it handles currency rounding.",
    expected_output_notes: "Entry points and data models are named explicitly (real files/functions), not described vaguely; the map stays scoped to the requested subsystem.",
  },

  // ─── ops_infra (+3) ──────────────────────────────────────────────────
  {
    title: "Draft a Production Incident Postmortem",
    slug: "draft-a-production-incident-postmortem",
    description: "Turn incident timeline data (logs, alerts, thread excerpts) into a structured postmortem draft for human review.",
    category: "ops_infra",
    tags: ["infra", "incident-response"],
    trigger_description: "A production incident has been resolved and needs a postmortem written while the details are still fresh.",
    instructions_body:
      "Assemble the timeline from the raw inputs (alert timestamps, log excerpts, chat thread) into chronological order. Produce: a short summary of impact, the timeline itself, the contributing factors (not just the immediate trigger — what allowed it to happen and what let it escalate), and a list of concrete action items each with a plausible owner. Draft this for human review and correction, not as a final published document — flag any gap in the timeline where the available data doesn't make the sequence clear.",
    required_tools_guidance: "Read access to alerting history, logs, and the incident's chat thread or ticket.",
    example_usage:
      "Input: alert timestamps, a Slack thread, and error logs from a 40-minute outage. Output: a postmortem draft with a timeline, 3 contributing factors, and 4 action items with owners, plus one flagged gap where the root-cause trigger time is uncertain.",
    expected_output_notes: "Contributing factors go beyond the immediate trigger; every action item has a plausible owner, not 'the team'; timeline gaps are flagged, not smoothed over.",
  },
  {
    title: "Triage a Failing CI Run",
    slug: "triage-a-failing-ci-run",
    description: "Classify a CI failure — flaky, infra, or a real regression — and route it to the right owner with evidence.",
    category: "ops_infra",
    tags: ["ci", "infra"],
    trigger_description: "A CI run failed and someone needs to know quickly whether it's a real problem or noise, without re-running it themselves.",
    instructions_body:
      "Read the failure output and classify it into one of: a real regression (the code change actually broke something), a flaky/intermittent failure (compare against recent run history for the same test), or infra/environment failure (a timeout, a dependency install failure, a runner issue unrelated to the code). Back the classification with evidence from the actual logs, not a guess. Route real regressions to the author of the change that broke it, and infra failures to whoever owns the CI pipeline.",
    required_tools_guidance: "Read access to the failing run's full logs and recent run history for comparison.",
    example_usage:
      "Input: a failed CI run on a PR. Output: classified as infra (npm registry timeout, unrelated to the diff) with the specific log line as evidence, routed back to re-run rather than to the PR author.",
    expected_output_notes: "The classification cites a specific piece of evidence from the actual logs, not a plausible-sounding guess; routing matches the classification (a real regression goes to the code author, not to CI ops).",
  },
  {
    title: "Audit Secrets and Config Drift",
    slug: "audit-secrets-and-config-drift",
    description: "Diff deployed environment config/secrets references against what the codebase actually reads, and flag the gaps.",
    category: "ops_infra",
    tags: ["infra", "security"],
    trigger_description: "It's unclear whether the deployed environment's config/secrets match what the current codebase actually needs — before an audit or after a refactor.",
    instructions_body:
      "Scan the codebase for every environment variable/secret it actually reads (not what a README claims). Compare against what's actually set in the deployed environment. Flag two directions of drift: variables the code reads that aren't set anywhere (a real bug waiting to happen), and variables that are set but no longer read by any code (stale, safe to remove — but confirm nothing dynamically constructs the variable name before declaring it unused).",
    required_tools_guidance: "Read access to the codebase and to the deployed environment's config/secrets list (names only, not values).",
    example_usage:
      "Input: a codebase and its Vercel project's env var list. Output: 1 variable read by code but unset in production (flagged urgent), 3 variables set but no longer referenced anywhere in code (flagged for removal after confirming no dynamic construction).",
    expected_output_notes: "Every 'unused' flag is checked for dynamic variable-name construction before being declared safe to remove; every 'missing' flag names the specific file/line that reads it.",
  },

  // ─── data_analysis (+3) ──────────────────────────────────────────────
  {
    title: "Reconcile a Bank Statement Against Ledger Entries",
    slug: "reconcile-a-bank-statement-against-ledger-entries",
    description: "Reconcile a CSV bank/payment-processor export against internal ledger entries and flag mismatches.",
    category: "data_analysis",
    tags: ["finance", "csv"],
    trigger_description: "A bank or payment-processor statement export needs to be checked against internal ledger records for a period close or an audit.",
    instructions_body:
      "Match transactions between the statement export and the ledger by amount, date, and any available reference/memo field — not amount alone, since amounts can coincidentally match. Produce a discrepancy report covering: transactions in the statement with no matching ledger entry, ledger entries with no matching statement transaction, and matched pairs with a mismatched amount (even a small rounding difference). Do not silently auto-resolve any mismatch; every discrepancy is reported for human review.",
    required_tools_guidance: "Read access to both the statement export and the ledger records, in a comparable format.",
    example_usage:
      "Input: a 200-row bank CSV export and the corresponding ledger period. Output: 3 unmatched statement transactions, 1 unmatched ledger entry, 1 matched pair with a $0.02 rounding discrepancy.",
    expected_output_notes: "Matching uses more than amount alone to avoid false matches; every discrepancy category is reported explicitly, none silently resolved or dropped.",
  },
  {
    title: "Detect an API Usage or Cost Anomaly",
    slug: "detect-an-api-usage-or-cost-anomaly",
    description: "Find week-over-week anomalies in exported usage/billing logs and attribute them to a likely cause.",
    category: "data_analysis",
    tags: ["analytics", "billing"],
    trigger_description: "API usage, token spend, or cloud cost jumped and someone needs to know what caused it before the next bill.",
    instructions_body:
      "Compare the current period's usage/cost against a recent baseline (prior week, prior comparable period), broken down by the dimensions available (endpoint, service, environment, caller). Isolate whether the increase is broad or concentrated in one dimension. Cross-reference the timing against recent deploys or config changes. State the most likely cause as a ranked hypothesis with the specific number backing it, not an unverified guess.",
    required_tools_guidance: "Query access to the usage/billing export and, if available, recent deploy history.",
    example_usage:
      "Input: 'API costs jumped 40% this week.' Output: isolated to one endpoint's call volume, correlated with a deploy that removed a caching layer — ranked as the top hypothesis with the specific before/after call-count numbers.",
    expected_output_notes: "The hypothesis is backed by a specific number from the actual data, not intuition; broad-vs-concentrated is checked before naming a cause.",
  },
  {
    title: "Assess Data-Loss Risk in a Migration Script",
    slug: "assess-data-loss-risk-in-a-migration-script",
    description: "Cross-check a database migration script against production schema and existing queries for irreversible operations.",
    category: "data_analysis",
    tags: ["postgres", "migrations"],
    trigger_description: "A migration script is about to be merged and needs a risk check before it runs against production.",
    instructions_body:
      "Read the migration statement by statement and flag every operation that's irreversible or destructive if wrong: dropped columns/tables, type changes that could truncate or lose precision on existing data, and constraint additions that could fail against existing rows the migration doesn't account for. For each flagged operation, check whether existing application queries depend on what's being changed. State the actual risk level per operation, not a blanket 'this migration is risky'.",
    required_tools_guidance: "Read access to the migration script, the current production schema, and the codebase's queries against the affected table(s).",
    example_usage:
      "Input: a migration dropping a column and adding a NOT NULL constraint to another. Output: the drop flagged as irreversible with 2 still-referencing queries found in code; the NOT NULL flagged as likely to fail given 40 existing NULL rows found via a quick check.",
    expected_output_notes: "Each flagged operation names the specific irreversibility/failure risk and, where checkable, the actual referencing code or row data — not a generic 'be careful with migrations' warning.",
  },

  // ─── research_docs (+4) ──────────────────────────────────────────────
  {
    title: "Generate a Changelog From Merged PRs",
    slug: "generate-a-changelog-from-merged-prs",
    description: "Aggregate merged PRs since the last release tag into a categorized, human-readable changelog.",
    category: "research_docs",
    tags: ["documentation", "release"],
    trigger_description: "A release is being cut and needs a changelog generated from what actually merged since the last tag.",
    instructions_body:
      "Pull every PR merged since the last release tag. Categorize each into the project's existing changelog conventions (e.g. Features, Fixes, Breaking Changes — match whatever categories the project's own past changelogs already use, don't invent new ones). Write each entry in user-facing language, not the raw PR title if that title is internal jargon. Flag any merged PR that looks like it should be a breaking change but wasn't labeled as one, rather than silently categorizing it as a minor fix.",
    required_tools_guidance: "Read access to the PR/commit history since the last release tag and to any prior changelog for convention-matching.",
    example_usage:
      "Input: 14 PRs merged since v2.3.0. Output: a categorized changelog matching the project's existing format, with one PR flagged for review since it changes a public API shape but wasn't tagged breaking.",
    expected_output_notes: "Categories match the project's own established changelog conventions, not a generic template; entries are user-facing, not raw PR titles; unlabeled likely-breaking changes are flagged, not silently miscategorized.",
  },
  {
    title: "Check for API Documentation Drift",
    slug: "check-for-api-documentation-drift",
    description: "Compare a project's actual public API surface against its docs and flag undocumented or stale entries.",
    category: "research_docs",
    tags: ["documentation", "api"],
    trigger_description: "It's been a while since the docs and the actual API were compared directly, and drift is suspected.",
    instructions_body:
      "Enumerate the actual public API surface from the code (exported functions, routes, or endpoints — whatever 'public' means for this project). Compare against what the docs currently describe. Flag two directions: real API surface with no documentation entry at all, and documented entries that no longer match the real signature/behavior (parameter changed, endpoint removed, behavior changed). Do not flag intentionally-undocumented internal/experimental APIs if they're clearly marked as such in code.",
    required_tools_guidance: "Read access to the codebase's actual exported/public API surface and to the existing documentation.",
    example_usage:
      "Input: a REST API's route definitions and its OpenAPI spec. Output: 2 routes present in code but missing from the spec, 1 spec entry describing a parameter that no longer exists in the route handler.",
    expected_output_notes: "Every flagged gap names the specific function/route and the exact mismatch (missing vs. stale vs. removed), not a vague 'docs seem out of date'.",
  },
  {
    title: "Synthesize a Design Doc From a Discussion Thread",
    slug: "synthesize-a-design-doc-from-a-discussion-thread",
    description: "Turn a scattered Slack/GitHub-discussion thread into a structured RFC — problem, options considered, decision, open questions.",
    category: "research_docs",
    tags: ["documentation", "planning"],
    trigger_description: "A design decision was worked out ad hoc across a chat thread or discussion and needs to become a durable, structured doc.",
    instructions_body:
      "Read the full thread and extract: the actual problem being solved (not just the first message's framing, since threads often refine the problem as they go), the options that were genuinely considered (not every tangent), which option was decided on and why, and any question raised but never actually resolved. Attribute reasoning to what was actually said in the thread — don't invent a rationale that sounds plausible but wasn't stated.",
    required_tools_guidance: "Read access to the full discussion thread; write access to save the resulting doc.",
    example_usage:
      "Input: a 60-message Slack thread debating two caching approaches. Output: an RFC with the refined problem statement, both options with their actual stated tradeoffs, the decided approach with the thread's real reasoning, and 1 open question about cache invalidation that was raised but never answered.",
    expected_output_notes: "Every stated rationale traces back to something actually said in the thread; open questions are only ones genuinely left unresolved, not ones the doc's author is inventing to seem thorough.",
  },
  {
    title: "Build a Third-Party Library Evaluation Matrix",
    slug: "build-a-third-party-library-evaluation-matrix",
    description: "Compare 2-4 candidate libraries for a need across maintenance, size, license, and migration cost, with a recommendation.",
    category: "research_docs",
    tags: ["research", "dependencies"],
    trigger_description: "A 'build vs. buy' or 'which library' decision needs to be made and the options haven't been compared systematically yet.",
    instructions_body:
      "For each candidate, check: recent maintenance activity (last release date, open issue/PR responsiveness — not just star count), bundle size or install footprint if relevant, license compatibility with this project's own license, and the actual migration/integration cost given how this codebase currently does the thing the library would replace. Produce a comparison matrix, then a recommendation with the specific reasoning — not just 'library A has more stars'.",
    required_tools_guidance: "Web access to check each library's repo activity, license, and docs; read access to the codebase for migration-cost estimation.",
    example_usage:
      "Input: 'date handling — date-fns vs. Luxon vs. day.js for our Next.js app.' Output: a matrix scoring maintenance/size/license/migration cost for all three, recommending day.js given the project's existing usage pattern and its smaller bundle impact.",
    expected_output_notes: "The recommendation cites the specific factors that decided it (not popularity alone), and migration cost is estimated against this codebase's actual current usage, not in the abstract.",
  },

  // ─── automation (+2) ──────────────────────────────────────────────────
  {
    title: "Coordinate a Cross-Repo Dependency Bump",
    slug: "coordinate-a-cross-repo-dependency-bump",
    description: "When a shared internal package changes, find every downstream consumer, open matching update PRs, and track merges.",
    category: "automation",
    tags: ["automation", "dependencies"],
    trigger_description: "A shared internal package/library just published a new version and every repo that depends on it needs to be updated consistently.",
    instructions_body:
      "Find every repo in scope that actually depends on the changed package (not just repos that might plausibly use it — check their actual manifest files). For each, open an update PR with a consistent title/description format, including the changed package's actual changelog for that version so reviewers know what's different. Track which PRs have merged and which are still open, and report the overall rollout status rather than treating each PR as a fire-and-forget.",
    required_tools_guidance: "Read access across every candidate repo's dependency manifest; write access to open PRs in each; read access to the changed package's changelog.",
    example_usage:
      "Input: 'internal-ui-kit just released v4.2.0 with a breaking prop rename.' Output: 6 repos found actually depending on it, 6 PRs opened with the breaking-change note called out, a tracked status of 4 merged / 2 open after a week.",
    expected_output_notes: "Only repos with an actual dependency get a PR (no speculative ones); each PR description includes the real changelog delta, not a generic 'bump version' message; rollout status is tracked, not abandoned after opening.",
  },
  {
    title: "Sanity-Check a Scheduled Data Export",
    slug: "sanity-check-a-scheduled-data-export",
    description: "Verify a recurring automated export's row counts, schema, and null-rate deltas before it's trusted downstream.",
    category: "automation",
    tags: ["automation", "data-quality"],
    trigger_description: "A scheduled/automated data export just ran and needs a quick correctness check before whatever consumes it downstream trusts the output.",
    instructions_body:
      "Compare this run's output against the prior run(s): row count within a plausible range (not zero, not an order of magnitude off, unless that's actually expected), the same schema/column set as before (a silently dropped or renamed column is a common real failure), and null-rate deltas per column (a column that was rarely null suddenly being mostly null is a red flag even if the row count and schema both look fine). Flag anomalies before the export is trusted downstream, don't just report 'export completed'.",
    required_tools_guidance: "Read access to this run's output and at least one prior run's output for comparison.",
    example_usage:
      "Input: today's export vs. yesterday's. Output: row count within range, schema unchanged, but one column's null rate jumped from 2% to 60% — flagged as likely an upstream data-source issue, not trusted for downstream use until confirmed.",
    expected_output_notes: "Every check is a real comparison against a prior run, not an isolated look at today's output alone; anomalies are flagged with the specific metric and delta, not a vague 'looks off'.",
  },

  // ─── content_creation (+2) ────────────────────────────────────────────
  {
    title: "Adapt Release Notes Into Multi-Channel Announcements",
    slug: "adapt-release-notes-into-multi-channel-announcements",
    description: "Turn a finished changelog into channel-specific drafts — Slack, a short social post, an email blurb — without drifting from the facts.",
    category: "content_creation",
    tags: ["content", "release"],
    trigger_description: "A changelog/release notes doc is finished and needs to become announcements for several different channels.",
    instructions_body:
      "Start from the finished changelog as the single source of truth — don't invent claims beyond what it states. Adapt tone and length per channel (a Slack announcement can be more detailed and casual; a social-length post needs the single most important change stated tightly; an email needs a clear subject and a short lead before any detail). Every factual claim in every draft must trace back to something the changelog actually says.",
    required_tools_guidance: "None beyond reading the finished changelog — no external tools required.",
    example_usage:
      "Input: a changelog with 5 entries, one being a major new feature. Output: a Slack post covering all 5, a one-line social post leading with just the major feature, an email with that feature as the lead and the rest as a bulleted list below.",
    expected_output_notes: "No channel draft states a fact not present in the source changelog; the major/minor prioritization is consistent with what the changelog itself signals as significant.",
  },
  {
    title: "Draft a FAQ Entry From a Resolved Support Ticket",
    slug: "draft-a-faq-entry-from-a-resolved-support-ticket",
    description: "Extract the reusable question/answer from a resolved support ticket and draft it into the project's existing FAQ format.",
    category: "content_creation",
    tags: ["content", "support"],
    trigger_description: "A support ticket got resolved and the underlying question looks likely to come up again — worth turning into a durable FAQ entry.",
    instructions_body:
      "Read the resolved ticket thread and extract the generalizable question (strip anything specific to that one user's account/situation) and the actual resolution that worked. Write it in the project's existing FAQ format and tone, not the ticket's own back-and-forth phrasing. If the resolution involved a workaround rather than a real fix, say so explicitly rather than presenting a workaround as if it were the intended behavior.",
    required_tools_guidance: "Read access to the resolved ticket thread and the existing FAQ/knowledge-base for format-matching.",
    example_usage:
      "Input: a ticket where a user's export kept timing out, resolved by breaking the date range into smaller chunks. Output: a FAQ entry titled around 'my export times out', with the chunking workaround explicitly noted as a workaround, not a permanent fix.",
    expected_output_notes: "The entry is stripped of user-specific detail from the original ticket; workarounds are labeled as workarounds, not presented as intended behavior.",
  },
];
