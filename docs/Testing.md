# Testing

FitTrack uses Vitest with Testing Library on happy-dom. Tests live next to the code they cover.

## Running tests

| Command | What it does |
| --- | --- |
| `npm run test` | Runs every test once. This is what CI runs. |
| `npm run test:watch` | Watch mode |
| `npm run test:ui` | Vitest's browser UI |
| `npm run test:coverage` | Coverage. TODO: confirm it works; the `v8` provider is configured but `@vitest/coverage-v8` is not in `package.json`. |

Run one file with `npx vitest --run src/stores/cardio.test.ts`.

## Setup

`vitest.config.ts`:

| Setting | Value |
| --- | --- |
| `globals` | `true` |
| `environment` | `happy-dom` |
| `setupFiles` | `./src/tests/setup.ts` |
| `@/` alias | `src/` |

`src/tests/setup.ts` loads the `@testing-library/jest-dom` matchers. It also installs an in-memory `localStorage` when none exists. The comment explains why: Node 25 and later ships its own `localStorage` global that is undefined unless Node is started with a flag, and it shadows the one happy-dom provides.

`src/tests/factories.ts` has `createMockExercise`, `createMockRoutine`, `createMockWorkoutSession` and `createMockExercisePerformance`.

## Kinds of test

| File name | Use for | Count at `dc35708` |
| --- | --- | --- |
| `foo.test.ts` | Pure functions in `utils/`, and store logic | 29 |
| `Foo.test.tsx` | A single component or hook rendered in isolation | 8 |
| `Foo.e2e.test.tsx` | User flows: render, click, type with `@testing-library/user-event`, assert on what the user sees | 16 |
| `foo.property.test.ts` | Invariants that must hold for many inputs | 2 |

There are 55 test files in total.

The "e2e" tests run in happy-dom, not a real browser. They render a component with its stores and drive it as a user would.

The property tests generate many scenarios in plain TypeScript and assert invariants over all of them, for example that a completion percentage stays within 0 to 100. No property-testing library is installed.

## Conventions

From `.kiro/steering/testing.md`.

**Test behaviour, not implementation.** Query by role, label or visible text, for example `getByRole('button', { name: … })`. Do not query by class name or test id.

### Mocking

| What | How |
| --- | --- |
| Storage | `vi.mock('@/services/storage', …)` with only the `storageService` methods the test touches. Tests do not use a real IndexedDB. |
| Toasts | Mock `sonner` when asserting on toast calls |
| Supabase | Mock `./supabaseClient` in `cloudSync` tests. Never hit the network. |
| Capacitor | On happy-dom `Capacitor.isNativePlatform()` is false, so web paths run by default. To test a native path, `vi.mock` the plugin module and the `Capacitor` check. |

Storage mock example:

```ts
vi.mock('@/services/storage', () => ({
  storageService: {
    saveCardioSession: vi.fn(async () => {}),
    getAllCardioSessions: vi.fn(async () => []),
  },
}))
```

### Store isolation

Zustand stores are module-level singletons, so state leaks between tests unless you reset it.

```ts
const INITIAL = useCardioStore.getState()

beforeEach(() => {
  useCardioStore.setState(INITIAL, true)
})
```

### Time

- Use `vi.useFakeTimers()` with `vi.setSystemTime(...)`, and restore real timers in `afterEach`.
- To simulate the app being suspended, move the system time **without** advancing timers, then dispatch `visibilitychange`. See `src/stores/restTimer.test.ts`.
- Tests must not depend on the real current date. Pin the time, or build dates relative to a fixed one.

## Expectations

- Every bug fix gets a test that fails without the fix.
- New stores, utils and user-visible flows get tests in the same change.
- A new kind of record needs a store test and a backup export round-trip test. See [Data Model and Storage](Data-Model-and-Storage.md#adding-a-new-kind-of-record).

## Linting

`npm run lint` runs oxlint with `.oxlintrc.json`: the `react`, `typescript` and `oxc` plugins, `react/rules-of-hooks` as an error, and `react/only-export-components` as a warning. The existing `only-export-components` warnings are known (`.kiro/steering/tech.md`).

## Related pages

- [CI, Security and Release](CI-Security-and-Release.md) for what runs on a push.
- [UI and Design System](UI-and-Design-System.md) for the accessibility rules the queries rely on.
