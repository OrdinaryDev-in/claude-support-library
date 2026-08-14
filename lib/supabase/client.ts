import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database.types";

/**
 * Browser Supabase client — used only in client components that need to
 * call Supabase directly (e.g. the auth forms). All data reads/writes for
 * prompts go through server actions instead, so RLS is evaluated with the
 * server-verified session, not a client-supplied one.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
