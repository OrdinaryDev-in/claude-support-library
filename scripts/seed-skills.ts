// Idempotent seed loader for DevAtlas's starter skills — mirrors
// scripts/seed-prompts.ts.
//
// Usage (after filling in .env.local from .env.local.example):
//   npm run seed:skills
//
// Safe to re-run: skills are upserted by slug, tags are upserted by slug,
// and the seed author (shared with scripts/seed-prompts.ts) is created
// once and reused on subsequent runs.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/types/database.types";
import { SEED_SKILLS } from "./seed-skills-data";

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
    .eq("resource_type", "skill");
  const categoryIdByKey = new Map((categoryRows ?? []).map((c) => [c.key, c.id]));

  for (const skill of SEED_SKILLS) {
    const categoryId = categoryIdByKey.get(skill.category);
    if (!categoryId) {
      console.error(`✗ ${skill.slug}: no categories row for key "${skill.category}" — run the skills migration first.`);
      continue;
    }

    const { data: skillRow, error } = await supabase
      .from("skills")
      .upsert(
        {
          author_id: authorId,
          title: skill.title,
          slug: skill.slug,
          description: skill.description,
          category_id: categoryId,
          trigger_description: skill.trigger_description,
          instructions_body: skill.instructions_body,
          required_tools_guidance: skill.required_tools_guidance,
          example_usage: skill.example_usage,
          expected_output_notes: skill.expected_output_notes,
          // Starter library content ships pre-reviewed — same reasoning as
          // scripts/seed-prompts.ts: a re-run only keeps status='approved'
          // if the content is unchanged, since guard_skill_review_state()
          // (20260824140000_skills.sql) resubmits any content edit.
          status: "approved",
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (error || !skillRow) {
      console.error(`✗ ${skill.slug}:`, error?.message);
      continue;
    }

    await syncTags(supabase, skillRow.id, skill.tags);
    console.log(`✓ ${skill.slug}`);
  }

  console.log(`\nDone — ${SEED_SKILLS.length} skills upserted.`);
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

async function syncTags(supabase: ReturnType<typeof createClient<Database>>, skillId: string, tagNames: string[]) {
  await supabase.from("skill_tags").delete().eq("skill_id", skillId);

  for (const name of tagNames) {
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
    const { data: tag } = await supabase
      .from("tags")
      .upsert({ name: name.trim().toLowerCase(), slug }, { onConflict: "slug" })
      .select("id")
      .single();
    if (tag) {
      await supabase.from("skill_tags").upsert({ skill_id: skillId, tag_id: tag.id });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
