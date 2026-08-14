import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database.types";

/**
 * Server-side Supabase client for Server Components, Server Actions and
 * Route Handlers. This is the primary data-access path for the app — RLS
 * (using the session's JWT from cookies) is the real authorization
 * boundary, never a service-role key in runtime code.
 *
 * Create a fresh client per request; never share one across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies — the
            // proxy (see proxy.ts) is responsible for refreshing the
            // session in that case, so this is safe to ignore.
          }
        },
      },
    }
  );
}
