import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

/**
 * Integration tests against a REAL Postgres instance for
 * guard_prompt_review_state() (supabase/migrations/0009_prompt_review_workflow.sql,
 * refreshed by 0014/0017/0018) and prevent_email_self_edit()
 * (0016_protect_profile_email_self_edit.sql) — the review-workflow's
 * counterparts to prevent_role_self_escalation
 * (test/integration/role-escalation.test.ts), which had test coverage but
 * these never did, despite guard_prompt_review_state already needing a
 * non-trivial rewrite once (0014).
 *
 * Same gating as role-escalation.test.ts: only runs against the local
 * stack (`supabase start` + `supabase db reset`), never a real project —
 * these tests sign up throwaway accounts and mutate rows directly.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const isLocalSupabase = Boolean(
  supabaseUrl && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(supabaseUrl)
);
// The admin-exemption / tag-resubmit tests need to promote an account to
// admin, which (same as e2e/core-flows.spec.ts) requires the service-role
// key — not present in every local setup that has the anon key configured.
const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const basePromptFields = {
  description: "Integration test fixture.",
  category: "backend" as const,
  base_instructions: "b",
  fill_in_details_guidance: "f",
  reference_projects_guidance: "r",
  reference_links_guidance: "l",
  expected_output_notes: "e",
};

describe.skipIf(!isLocalSupabase)("guard_prompt_review_state trigger", () => {
  let supabase: SupabaseClient<Database>;
  let admin: SupabaseClient<Database>;
  let userId: string;
  const email = `review-guard-test-${Date.now()}@example.com`;
  const password = crypto.randomUUID();
  const createdPromptIds: string[] = [];

  beforeAll(async () => {
    supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      // Falls back to the anon key when no service key is configured —
      // the service_role-only tests below skip themselves in that case
      // (skipIf(!hasServiceRole)), so this client is simply unused then.
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      throw new Error(`Test setup failed to sign up: ${error?.message}`);
    }
    userId = data.user.id;
  });

  afterAll(async () => {
    if (hasServiceRole && createdPromptIds.length > 0) {
      await admin.from("prompts").delete().in("id", createdPromptIds);
    }
    await supabase.auth.signOut();
  });

  async function insertPrompt(overrides: Partial<Database["public"]["Tables"]["prompts"]["Insert"]> = {}) {
    const slug = `review-guard-${crypto.randomUUID()}`;
    const { data, error } = await supabase
      .from("prompts")
      .insert({
        ...basePromptFields,
        author_id: userId,
        title: slug,
        slug,
        ...overrides,
      })
      .select("id, status")
      .single();
    if (data) createdPromptIds.push(data.id);
    return { data, error };
  }

  it("rejects reviewed_by/reviewed_at/rejection_reason forged on a fresh INSERT", async () => {
    // prompts_insert_own's WITH CHECK (0017_guard_prompt_insert_review_fields.sql)
    // requires these null for a non-admin insert — without it, an author
    // could forge a fake review audit trail on their own pending prompt.
    const { error } = await insertPrompt({
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("rejects rejection_reason forged on a fresh INSERT", async () => {
    const { error } = await insertPrompt({ rejection_reason: "forged" });
    expect(error).not.toBeNull();
  });

  it("still allows a normal insert with no review fields set", async () => {
    const { data, error } = await insertPrompt();
    expect(error).toBeNull();
    expect(data?.status).toBe("pending_review");
  });

  it("silently reverts a direct self-approval update, no error raised", async () => {
    const { data: created } = await insertPrompt();
    expect(created).not.toBeNull();

    const { error } = await supabase
      .from("prompts")
      .update({ status: "approved" })
      .eq("id", created!.id);
    // Same shape as prevent_role_self_escalation: RLS's WITH CHECK still
    // passes (the author owns the row), so the UPDATE succeeds — the
    // trigger just pins status back rather than raising.
    expect(error).toBeNull();

    const { data: after } = await supabase.from("prompts").select("status").eq("id", created!.id).single();
    expect(after?.status).toBe("pending_review");
  });

  it.skipIf(!hasServiceRole)(
    "resubmits an approved prompt for review when its tags change",
    async () => {
      const { data: created } = await insertPrompt();
      expect(created).not.toBeNull();

      const { error: approveError } = await admin
        .from("prompts")
        .update({ status: "approved" })
        .eq("id", created!.id);
      expect(approveError).toBeNull();
      const { data: approved } = await admin.from("prompts").select("status").eq("id", created!.id).single();
      expect(approved?.status).toBe("approved"); // sanity check before exercising the real assertion

      const tagSlug = `review-guard-tag-${crypto.randomUUID()}`;
      const { data: tag, error: tagError } = await supabase
        .from("tags")
        .insert({ name: tagSlug, slug: tagSlug })
        .select("id")
        .single();
      expect(tagError).toBeNull();

      const { error: linkError } = await supabase
        .from("prompt_tags")
        .insert({ prompt_id: created!.id, tag_id: tag!.id });
      expect(linkError).toBeNull();

      const { data: after } = await supabase.from("prompts").select("status").eq("id", created!.id).single();
      expect(after?.status).toBe("pending_review");
    }
  );

  it.skipIf(!hasServiceRole)(
    "does NOT resubmit when an admin changes the tags",
    async () => {
      const { data: created } = await insertPrompt();
      expect(created).not.toBeNull();

      await admin.from("prompts").update({ status: "approved" }).eq("id", created!.id);

      const tagSlug = `review-guard-admin-tag-${crypto.randomUUID()}`;
      const { data: tag } = await admin.from("tags").insert({ name: tagSlug, slug: tagSlug }).select("id").single();
      const { error: linkError } = await admin
        .from("prompt_tags")
        .insert({ prompt_id: created!.id, tag_id: tag!.id });
      expect(linkError).toBeNull();

      const { data: after } = await admin.from("prompts").select("status").eq("id", created!.id).single();
      expect(after?.status).toBe("approved");
    }
  );
});

describe.skipIf(!isLocalSupabase)("prevent_email_self_edit trigger", () => {
  let supabase: SupabaseClient<Database>;
  let userId: string;
  const email = `email-guard-test-${Date.now()}@example.com`;
  const password = crypto.randomUUID();

  beforeAll(async () => {
    supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      throw new Error(`Test setup failed to sign up: ${error?.message}`);
    }
    userId = data.user.id;
  });

  afterAll(async () => {
    await supabase.auth.signOut();
  });

  it("silently reverts a direct email self-edit, no error raised", async () => {
    const spoofed = `spoofed-${crypto.randomUUID()}@example.com`;
    const { error } = await supabase.from("profiles").update({ email: spoofed }).eq("id", userId);
    expect(error).toBeNull();

    const { data } = await supabase.from("profiles").select("email").eq("id", userId).single();
    expect(data?.email).toBe(email);
  });

  it("still allows updating a non-email column on the same row", async () => {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: "Email Guard Test User" })
      .eq("id", userId);
    expect(error).toBeNull();
  });
});
