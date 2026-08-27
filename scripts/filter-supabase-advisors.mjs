#!/usr/bin/env node
// Reads `supabase db advisors --output-format json` from stdin, drops
// findings that match scripts/supabase-security-allowlist.json (each entry
// must carry a documented `reason`), prints the rest, and exits 1 if any
// blocking findings remain. See scripts/check-supabase-security.sh.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allowlist = JSON.parse(
  readFileSync(path.join(__dirname, "supabase-security-allowlist.json"), "utf8"),
);

const raw = readFileSync(0, "utf8").trim();
if (!raw) {
  console.log("No advisor output received.");
  process.exit(0);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch {
  console.error("Could not parse `supabase db advisors` JSON output:");
  console.error(raw);
  process.exit(1);
}

// Tolerate a few plausible shapes: the CLI's actual JSON output
// ({ results: [...], message: "db advisors" }), the MCP get_advisors
// shape ({ result: { lints: [...] } }) used as a fallback when developers
// run the equivalent check via Claude Code, and a bare array.
const lints =
  parsed?.results ??
  parsed?.result?.lints ??
  parsed?.lints ??
  (Array.isArray(parsed) ? parsed : null);

if (!Array.isArray(lints)) {
  console.error("Unrecognized `supabase db advisors` output shape:");
  console.error(JSON.stringify(parsed, null, 2));
  process.exit(1);
}

// An allowlist entry matches on `lint` name plus whichever metadata key it
// specifies (`function` for function-level findings, `table` for
// table-level ones like RLS-policy findings, `entity` for project-level
// ones like Auth settings — `function` and `table` both compare against
// the same underlying `metadata.name` field the advisor returns, just
// named for whichever kind of object the lint is actually about). An
// entry with none of these keys matches any finding of that lint name —
// keep entries specific.
const isAllowed = (lint) =>
  allowlist.some((a) => {
    if (a.lint !== lint.name) return false;
    if (a.function !== undefined && a.function !== lint.metadata?.name) return false;
    if (a.table !== undefined && a.table !== lint.metadata?.name) return false;
    if (a.entity !== undefined && a.entity !== lint.metadata?.entity) return false;
    return true;
  });

const allowed = lints.filter(isAllowed);
const blocking = lints.filter((l) => !isAllowed(l));

if (allowed.length) {
  console.log(
    `Ignoring ${allowed.length} allowlisted finding(s) (scripts/supabase-security-allowlist.json):`,
  );
  for (const l of allowed) {
    console.log(`  - [${l.level}] ${l.name} (${l.metadata?.name ?? "n/a"})`);
  }
}

if (!blocking.length) {
  console.log("No blocking Supabase security advisories.");
  process.exit(0);
}

console.log(`${blocking.length} blocking Supabase security advisory(ies):`);
for (const l of blocking) {
  console.log(`  - [${l.level}] ${l.name}: ${l.detail ?? l.title}`);
  if (l.remediation) console.log(`    remediation: ${l.remediation}`);
}
process.exit(1);
