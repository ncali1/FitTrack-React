# Architecture

FitTrack is a single-page React app with no backend of its own. State lives in Zustand stores, records live in IndexedDB, and an optional Supabase project mirrors them across devices.

## Folder layout

```
src/
  components/<feature>/   UI grouped by feature
  stores/                 Zustand stores, one per domain
  services/               Side effects and platform access
  hooks/                  Reusable React hooks
  utils/                  Pure functions
  data/                   Static data: the built-in exercise catalog
  types/index.ts          Shared domain types
  tests/                  Global test setup and factories
supabase/schema.sql       Cloud schema and row-level security
ios/, android/            Capacitor native projects
public/                   Static assets, icons, privacy.html
scripts/                  run-ios.sh, generate-icons.py
```

## Where code goes

From `.kiro/steering/structure.md`:

| Kind of code | Goes in | Rule |
| --- | --- | --- |
| Pure logic: maths, formatting, unit conversion | `src/utils/` | Takes data as parameters, no store imports. Unit test beside it. |
| Anything touching a platform API: IndexedDB, audio, notifications, wake lock, haptics, network | `src/services/` or a hook in `src/hooks/` | Never inline in a component. |
| Shared state | A store in `src/stores/` | Component-local UI state stays in the component. |
| Components | `src/components/<feature>/` | Presentational where possible: read from stores, call store actions. |

**Search before adding.** The steering doc records why: two branches once each built their own rest-over alert, keep-awake hook and sound setting, and merging them took real work. Extend what exists:

| Need | Use |
| --- | --- |
| Rest alerts (sound, haptic, notification) | `src/services/restAlert.ts` |
| Keep the screen awake | `src/hooks/useKeepAwake.ts` |
| Lock scrolling behind an overlay | `src/hooks/useBodyScrollLock.ts` |
| A preference | `src/stores/settings.ts`, shown in `src/components/profile/PreferencesCard.tsx` |
| Exercise history or suggestions | `src/utils/calculations.ts`, `src/utils/progressiveOverload.ts` |

## App shell

`src/main.tsx` renders `<App />` inside an `ErrorBoundary`, plus the sonner `<Toaster>`.

`src/App.tsx` chooses what to show, in this order:

1. `PasswordRecoveryGate` if a password-reset link was followed.
2. `Onboarding` until `fittrack-onboarding-complete` is set in localStorage.
3. `AuthGate` if cloud sync is configured, the user is signed out and has not skipped.
4. A loading screen, then an error screen with Retry if storage is full.
5. `Layout` with the active tab, plus three always-available widgets: `InstallPrompt`, `RestTimer` (mounted only while a rest is running) and `WorkoutReminder`.

There is no router. The active tab is a string in `useUIStore`, and `App.tsx` switches on it. Each tab unmounts when you leave it, which is why anything that must survive a tab switch lives in a store.

The Progress tab is lazy-loaded. `App.tsx` explains why: Chart.js is the largest dependency, and splitting it out keeps it out of every other tab's initial bundle.

## Startup sequence

`loadEverything` in `src/App.tsx`:

1. `initializeApp()` (`src/hooks/useAppInitialization.ts`) loads all six data stores from IndexedDB in parallel with `Promise.allSettled`. One failed load does not block the others. A storage-quota error is shown to the user.
2. If cloud sync is configured and a user is signed in, `syncWithCloud()` runs in the background.
3. If the sync changed anything locally, `reloadAllStores()` re-reads every store.

Local data always loads first, so the app is usable whatever the network is doing.

## Stores

One Zustand store per domain, in `src/stores/`.

| Store | File | Holds | Persisted to |
| --- | --- | --- | --- |
| `useExercisesStore` | `exercises.ts` | The user's exercises | IndexedDB |
| `useRoutineStore` | `routine.ts` | Weekly programs (code name `Routine`) | IndexedDB |
| `useWorkoutTemplatesStore` | `workoutTemplates.ts` | Routines (code name `WorkoutTemplate`) | IndexedDB |
| `useWorkoutSessionsStore` | `workoutSessions.ts` | Workout sessions, plus memoised summaries | IndexedDB |
| `useBodyWeightStore` | `bodyWeight.ts` | Body weight log | IndexedDB |
| `useCardioStore` | `cardio.ts` | Cardio sessions | IndexedDB |
| `useSettingsStore` | `settings.ts` | Per-device preferences, last backup time | localStorage `fittrack-settings` |
| `useGuidedSessionStore` | `guidedSession.ts` | The in-progress guided workout | localStorage `fittrack-guided-session` |
| `useRestTimerStore` | `restTimer.ts` | The floating rest countdown | Memory only |
| `useAuthStore` | `auth.ts` | Supabase session and auth actions | Supabase client handles the session |
| `useUIStore` | `ui.ts` | Active tab, selected date, chart range | Memory only |

`reloadAllStores.ts` re-reads the six data stores from IndexedDB. It is called after anything rewrites the database underneath them: a sync that pulled changes, a backup import, or a full delete.

## The data store pattern

Every data store follows the same four steps. `src/stores/cardio.ts` is the cleanest example.

1. Update Zustand state first, so the UI responds at once.
2. Persist with `await storageService.saveX(...)`.
3. If signed in, call the matching `syncUpsertX` or `syncDeleteX` from `cloudSync` **without awaiting**. Sync is fire-and-forget.
4. On failure, set `error` to a readable message and rethrow.

Records get a `crypto.randomUUID()` id and `createdAt` / `updatedAt` in Unix milliseconds. Every mutation bumps `updatedAt`, because sync resolves conflicts on it. Empty optional fields are dropped rather than stored.

## How a tap becomes a saved record

Logging a cardio session, end to end:

```
CardioForm (component)
  -> useCardioStore.saveSession(input)            src/stores/cardio.ts
       1. set({ sessions: [...] })                UI updates immediately
       2. storageService.saveCardioSession(...)   src/services/storage.ts
            -> db.cardioSessions.put(...)         src/services/database.ts (Dexie -> IndexedDB)
            -> protectStorageOnce()               src/services/persistentStorage.ts
       3. syncUpsertCardioSession(userId, ...)    src/services/cloudSync.ts (only if signed in, not awaited)
            -> queued in localStorage, then sent to Supabase
```

Components never import `db` or `cloudSync` to write records. They call a store action.

## Services

| File | Responsibility |
| --- | --- |
| `database.ts` | The Dexie database definition and its versions |
| `storage.ts` | `storageService`: all CRUD on IndexedDB, with retries. The only code that touches `db`. |
| `persistentStorage.ts` | Asks the browser not to evict storage, and reports whether it agreed |
| `cloudSync.ts` | The Supabase sync: outbox, push, pull, tombstones |
| `supabaseClient.ts` | Lazily creates the Supabase client, or returns `null` when not configured |
| `restAlert.ts` | "Rest is over" beep, haptic and notification |
| `webgl.ts` | One cached check for WebGL support |

`storageService` retries a failed operation up to three times with delays of 100, 500 and 1000 ms. A quota error is not retried: it throws `StorageQuotaError` straight away, since retrying cannot help.

## Hooks

| Hook | Purpose |
| --- | --- |
| `useAppInitialization` | Startup load and full reset |
| `useActiveProgram` | The active program with its routines expanded into exercise lists |
| `useBackupExport` | One shared "export a backup" action that also records the backup time |
| `useBodyScrollLock` | Stops the page behind an overlay from scrolling. Counted, so stacked overlays work. |
| `useKeepAwake` | Keeps the screen on. Reference-counted across components. |
| `useStorageProtection` | Storage protection status plus a way to ask again |

## Utils

Pure functions in `src/utils/`, each with a test beside it.

| File | What it does |
| --- | --- |
| `calculations.ts` | Local date helpers, weekly summary, progress aggregation, exercise history, session volume, streak, planned exercises for a date |
| `units.ts` | kg and lb conversion and formatting |
| `cardio.ts` | Cardio types, distance conversion, pace and duration formatting, weekly totals |
| `personalRecords.ts` | Best weight and reps, and detecting a new record |
| `progressiveOverload.ts` | Suggests the next weight and reps |
| `oneRepMax.ts` | Estimated one-rep max (Epley) |
| `warmupSets.ts` | Warm-up ramp for a working weight |
| `plateCalculator.ts` | Plates per side for a barbell weight |
| `exerciseSwap.ts` | Finds stand-in exercises by muscle region |
| `muscleBalance.ts` | Completed sets per muscle group |
| `muscleRegions.ts`, `muscleGroupStyles.ts` | Muscle group to body region mapping, and (deliberately monochrome) group styling |
| `exercisePoses.ts`, `figureRig.ts` | Poses and bone mapping for the 3D exercise figure |
| `libraryExercise.ts` | Finds or creates the user's copy of a catalog exercise |
| `backupReminder.ts` | When to show the backup reminder |
| `reminders.ts` | When to show the workout nudge |
| `exportData.ts` | Build, download, validate and restore a backup |
| `validators.ts` | Form validation |

## Two patterns worth knowing

### Derive from the wall clock, never count down

Anything that counts down or measures elapsed time stores a timestamp (`endsAt`, `startedAt`) and recomputes from `Date.now()` on each tick and on `visibilitychange`. Browsers throttle or suspend timers in the background, so a counter decremented per tick drifts. See `src/stores/restTimer.ts`.

Dates are local `YYYY-MM-DD` strings. Use `todayString()` and `toDateString()` from `src/utils/calculations.ts`, never `toISOString()`: that is UTC, so in the evening west of Greenwich it already reads as tomorrow. Call them when rendering, not at module load, since the app can stay open past midnight.

### Zustand selectors and reference stability

`src/stores/routine.ts` carries a long comment on this. The short version:

- Selecting a store **method** (`useRoutineStore((s) => s.routineForDay)`) does not subscribe the component to the data that method reads. Select the raw array and derive from it.
- A selector must return a referentially stable value when nothing changed. A function that builds a new object each call, used inside a selector, causes an infinite render loop.
- The store's `getCached*` methods and `resolveRoutine` are memoised so they are safe inside selectors.

## Errors

Catch at the boundary, log with `console.error('Failed to …:', err)`, and degrade gracefully. A failed sound, haptic or sync must never break the workout flow (`.kiro/steering/tech.md`). `src/components/ErrorBoundary.tsx` is the last line: it shows a recovery screen for render errors. Workout data is unaffected because it is in IndexedDB, not React state.

## Related pages

- [Data Model and Storage](Data-Model-and-Storage.md)
- [Cloud Sync and Auth](Cloud-Sync-and-Auth.md)
- [Native and PWA](Native-and-PWA.md)
