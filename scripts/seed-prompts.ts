// Idempotent seed loader for DevAtlas's 18 starter prompts.
//
// Usage (after filling in .env.local from .env.local.example):
//   npm run seed
//
// Safe to re-run: prompts are upserted by slug, tags are upserted by slug,
// and the seed author is created once and reused on subsequent runs.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/types/database.types";
import { SEED_PROMPTS } from "./seed-data";

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

  // Service-role client — server-only, never used in the running app itself.
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authorId = await ensureSeedAuthor(supabase);
  console.log(`Seeding as author ${authorId} (${SEED_AUTHOR_EMAIL})`);

  for (const prompt of SEED_PROMPTS) {
    const { data: promptRow, error } = await supabase
      .from("prompts")
      .upsert(
        {
          author_id: authorId,
          title: prompt.title,
          slug: prompt.slug,
          description: prompt.description,
          category: prompt.category,
          base_instructions: prompt.base_instructions,
          fill_in_details_guidance: prompt.fill_in_details_guidance,
          reference_projects_guidance: prompt.reference_projects_guidance,
          reference_links_guidance: prompt.reference_links_guidance,
          expected_output_notes: prompt.expected_output_notes,
          // Starter library content ships pre-reviewed — see
          // guard_prompt_review_state() (0009_prompt_review_workflow.sql):
          // on a re-run this only sticks if the row's content is
          // unchanged from what's already stored, since editing an
          // approved row's content flips it back to pending_review same
          // as any other edit would.
          status: "approved",
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (error || !promptRow) {
      console.error(`✗ ${prompt.slug}:`, error?.message);
      continue;
    }

    await syncTags(supabase, promptRow.id, prompt.tags);
    console.log(`✓ ${prompt.slug}`);
  }

  console.log(`\nDone — ${SEED_PROMPTS.length} prompts upserted.`);
}

async function ensureSeedAuthor(
  supabase: ReturnType<typeof createClient<Database>>
): Promise<string> {
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
  // handle_new_user() (see supabase/migrations/0001_init.sql) auto-creates
  // the matching profiles row on user insert.
  return created.user.id;
}

async function syncTags(
  supabase: ReturnType<typeof createClient<Database>>,
  promptId: string,
  tagNames: string[]
) {
  await supabase.from("prompt_tags").delete().eq("prompt_id", promptId);

  for (const name of tagNames) {
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
    const { data: tag } = await supabase
      .from("tags")
      .upsert({ name: name.trim().toLowerCase(), slug }, { onConflict: "slug" })
      .select("id")
      .single();
    if (tag) {
      await supabase.from("prompt_tags").upsert({ prompt_id: promptId, tag_id: tag.id });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
