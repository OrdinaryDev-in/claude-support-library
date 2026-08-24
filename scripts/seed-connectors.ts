// Idempotent seed loader for DevAtlas's starter connectors — mirrors
// scripts/seed-skills.ts.
//
// Usage (after filling in .env.local from .env.local.example):
//   npm run seed:connectors
//
// Safe to re-run: connectors are upserted by slug, tags are upserted by
// slug, and the seed author (shared with scripts/seed-prompts.ts and
// scripts/seed-skills.ts) is created once and reused on subsequent runs.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/types/database.types";
import { SEED_CONNECTORS } from "./seed-connectors-data";

const SEED_AUTHOR_EMAIL = "seed@devatlas.internal";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}. Copy .env.local.example to .env.local and fill it in.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authorId = await ensureSeedAuthor(supabase);
  console.log(`Seeding as author ${authorId} (${SEED_AUTHOR_EMAIL})`);

  const { data: categoryRows } = await supabase
    .from("categories")
    .select("id, key")
    .eq("resource_type", "connector");
  const categoryIdByKey = new Map((categoryRows ?? []).map((c) => [c.key, c.id]));

  for (const connector of SEED_CONNECTORS) {
    const categoryId = categoryIdByKey.get(connector.category);
    if (!categoryId) {
      console.error(
        `✗ ${connector.slug}: no categories row for key "${connector.category}" — run the connectors migration first.`
      );
      continue;
    }

    const { data: connectorRow, error } = await supabase
      .from("connectors")
      .upsert(
        {
          author_id: authorId,
          title: connector.title,
          slug: connector.slug,
          description: connector.description,
          category_id: categoryId,
          setup_steps: connector.setup_steps,
          config_snippet: connector.config_snippet,
          gotchas_notes: connector.gotchas_notes,
          docs_links: connector.docs_links,
          // Starter library content ships pre-reviewed — same reasoning as
          // scripts/seed-skills.ts: a re-run only keeps status='approved'
          // if the content is unchanged, since guard_connector_review_state()
          // (20260824150000_connectors.sql) resubmits any content edit.
          status: "approved",
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (error || !connectorRow) {
      console.error(`✗ ${connector.slug}:`, error?.message);
      continue;
    }

    await syncTags(supabase, connectorRow.id, connector.tags);
    console.log(`✓ ${connector.slug}`);
  }

  console.log(`\nDone — ${SEED_CONNECTORS.length} connectors upserted.`);
}

async function ensureSeedAuthor(supabase: ReturnType<typeof createClient<Database>>): Promise<string> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", SEED_AUTHOR_EMAIL)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase.auth.admin.createUser({
    email: SEED_AUTHOR_EMAIL,
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: { full_name: "DevAtlas Team" },
  });
  if (error || !created.user) {
    throw new Error(`Could not create seed author: ${error?.message}`);
  }
  return created.user.id;
}

async function syncTags(supabase: ReturnType<typeof createClient<Database>>, connectorId: string, tagNames: string[]) {
  await supabase.from("connector_tags").delete().eq("connector_id", connectorId);

  for (const name of tagNames) {
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
    const { data: tag } = await supabase
      .from("tags")
      .upsert({ name: name.trim().toLowerCase(), slug }, { onConflict: "slug" })
      .select("id")
      .single();
    if (tag) {
      await supabase.from("connector_tags").upsert({ connector_id: connectorId, tag_id: tag.id });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
