import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

/**
 * Integration test against a REAL Postgres instance — confirms the
 * prevent_role_self_escalation trigger (supabase/migrations/0002_rls.sql)
 * actually blocks a signed-in user from promoting themselves to admin via
 * a direct `update profiles set role = 'admin'`, not just that the RLS
 * policy lets the UPDATE through (RLS alone can't restrict *which
 * columns* change — see README's "CI & security" section for why this
 * needs to be the trigger, not the policy).
 *
 * Needs a live database: run against the local stack (`supabase start`,
 * matching .github/workflows/ci.yml's test-e2e job), which is always
 * http://127.0.0.1:<port> by default. Deliberately gated on that host,
 * not just "are the env vars set" — a developer's own `.env.local`
 * normally points at the real shared project, and this test signs up
 * throwaway accounts, which must never happen against production. Skips
 * itself — doesn't fail the run — whenever the URL isn't local, so
 * `npm run test` stays safe to run with a normal dev `.env.local`.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const isLocalSupabase = Boolean(
  supabaseUrl && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(supabaseUrl)
);

describe.skipIf(!isLocalSupabase)("prevent_role_self_escalation trigger", () => {
  let supabase: SupabaseClient<Database>;
  let userId: string;
  const email = `role-escalation-test-${Date.now()}@example.com`;
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

  it("starts as role 'user' by default (handle_new_user)", async () => {
    const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
    expect(data?.role).toBe("user");
  });

  it("rejects a direct role='admin' update from the user themself", async () => {
    const { error } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", userId);

    // The trigger silently pins the column back to its old value (`new.role
    // := old.role`) rather than raising — RLS's WITH CHECK still passes
    // (auth.uid() = id is untouched), so the UPDATE itself succeeds with no
    // error. What actually proves the guard worked is that the row's role
    // never changed — see prevent_role_self_escalation() in 0002_rls.sql.
    expect(error).toBeNull();

    const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
    expect(data?.role).toBe("user");
  });

  it("still allows updating a non-role column on the same row", async () => {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: "Trigger Test User" })
      .eq("id", userId);

    expect(error).toBeNull();
  });
});
