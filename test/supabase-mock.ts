import { vi } from "vitest";

type MockResult = { data?: unknown; error?: unknown };

/**
 * supabase-js query builders are "thenable" — `.select().eq().single()`
 * and a bare `await supabase.from(t).update(...).eq(...)` both resolve
 * the same way. This proxy mimics that: every query-builder method
 * (`select`/`eq`/`neq`/`single`/`maybeSingle`/`update`/`insert`/`delete`/…)
 * just returns another proxy around the *same* result, so awaiting at
 * any point in the chain resolves to it.
 */
function chainable(result: MockResult) {
  const promise = Promise.resolve(result);
  return new Proxy(promise, {
    get(target, prop, receiver) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        return Reflect.get(target, prop, receiver).bind(target);
      }
      return () => chainable(result);
    },
  });
}

/**
 * Minimal Supabase client stub for unit-testing Server Actions'
 * authorization logic without a real database. Queue responses in the
 * exact order the function under test issues `.from(...)` calls — each
 * `.from()` call consumes (shifts) the next queued result; whatever
 * chain of methods follows resolves to that same result when awaited.
 *
 * `getUser` is separate (a distinct `supabase.auth.*` namespace, not a
 * `.from()` call) — set it directly per test via
 * `mock.auth.getUser.mockResolvedValue(...)`.
 */
export function createSupabaseMock(fromQueue: MockResult[] = []) {
  const remaining = [...fromQueue];
  return {
    from: vi.fn(() => {
      const result = remaining.shift() ?? { data: null, error: null };
      return chainable(result);
    }),
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      updateUser: vi.fn(),
    },
  };
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
