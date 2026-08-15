import { vi } from "vitest";

/**
 * Supabase-js's query builder is a fluent, thenable chain
 * (`.from().select().eq().single()`) — a plain object mock can't express
 * that. This returns a Proxy where every method call re-returns itself
 * (so any chain shape resolves) and the proxy itself is thenable,
 * resolving to the given `{ data, error }`.
 */
export function mockQueryResult(result: { data: unknown; error: unknown }) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => void) => resolve(result);
      }
      return vi.fn(() => proxy);
    },
  };
  const proxy = new Proxy({}, handler);
  return proxy;
}

/**
 * A minimal mock of the object returned by `lib/supabase/server.ts`'s
 * `createClient()`, for unit-testing server actions / auth helpers
 * without touching a real Supabase project.
 */
export function mockSupabaseClient(
  overrides: {
    user?: { id: string } | null;
    from?: (table: string) => unknown;
    rpc?: (...args: unknown[]) => unknown;
  } = {}
) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: overrides.user ?? null } }),
    },
    from: vi.fn((table: string) =>
      overrides.from ? overrides.from(table) : mockQueryResult({ data: null, error: null })
    ),
    rpc: vi.fn(overrides.rpc ?? (() => mockQueryResult({ data: null, error: null }))),
  };
}
