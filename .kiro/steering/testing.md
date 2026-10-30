---
inclusion: fileMatch
fileMatchPattern: ["**/*.test.ts", "**/*.test.tsx", "src/tests/**", "vitest.config.ts"]
---

# Testing

Vitest with `globals: true` on **happy-dom**, plus Testing Library and `@testing-library/jest-dom`
matchers. Global setup is `src/tests/setup.ts` (it also provides an in-memory `localStorage`
fallback for newer Node versions). Run with `npm run test`.

## Kinds of test

| File | Use for |
| --- | --- |
| `foo.test.ts` | Pure functions in `utils/`, and store logic |
| `Foo.e2e.test.tsx` | Real user flows: render, click, type with `@testing-library/user-event`, assert on what the user sees |
| `foo.property.test.ts` | Invariants that must hold for many inputs (e.g. session calculations) |

Test behaviour, not implementation. Query by role, label or visible text (`getByRole('button', { name: … })`),
not by class names or test ids.

## Mocking conventions

- **Storage:** mock `@/services/storage` with just the `storageService` methods the test touches.
  Tests don't use a real IndexedDB:
  ```ts
  vi.mock('@/services/storage', () => ({
    storageService: {
      saveCardioSession: vi.fn(async () => {}),
      getAllCardioSessions: vi.fn(async () => []),
    },
  }))
  ```
- **Toasts:** mock `sonner` when asserting on toast calls.
- **Supabase:** mock `./supabaseClient` in `cloudSync` tests. Never hit the network.
- **Store isolation:** capture `const INITIAL = useXStore.getState()` at module scope and
  `useXStore.setState(INITIAL, true)` in `beforeEach`, so tests don't leak state into each other.
- **Time:** use `vi.useFakeTimers()` + `vi.setSystemTime(...)`. To simulate the app being
  suspended, move the system time without advancing timers, then dispatch `visibilitychange`
  (see `src/stores/restTimer.test.ts`). Restore real timers in `afterEach`.
- **Capacitor:** on happy-dom `Capacitor.isNativePlatform()` is false, so the web paths run by
  default. To test a native path, `vi.mock` the plugin module and the `Capacitor` check.

## Expectations

- Every bug fix gets a test that fails without the fix.
- New stores, utils and user-visible flows get tests in the same change.
- Tests must not depend on the real current date. Pin the time, or build dates relative to a fixed one.
