---
inclusion: fileMatch
fileMatchPattern: ["src/stores/**", "src/services/**", "src/types/**", "src/utils/exportData.ts"]
---

# State and storage

## Two kinds of persisted data

| Kind | Where | Example |
| --- | --- | --- |
| Workout data (the user's records) | IndexedDB via Dexie (`src/services/database.ts`), accessed only through `storageService` (`src/services/storage.ts`) | exercises, sessions, cardio, body weight, routines |
| Per-device preferences | Zustand `persist` → localStorage key `fittrack-settings` (`src/stores/settings.ts`) | units, rest duration, sound/vibration, keep-awake |

Preferences are never synced or exported. Workout data is both.

## Data store pattern

Follow the existing stores (`cardio.ts` is a clean example):

1. Update Zustand state first so the UI responds instantly.
2. Persist with `await storageService.saveX(...)`.
3. If signed in (`useAuthStore.getState().user`), call the matching `syncUpsertX` /
   `syncDeleteX` from `cloudSync` **without awaiting** — sync is fire-and-forget.
4. On failure set `error` to a readable message and rethrow.

Records use `crypto.randomUUID()` ids and `createdAt` / `updatedAt` Unix-millisecond timestamps.
Store only the fields that were actually entered — drop empty optionals.

## Adding a new kind of record — the full checklist

Missing any of these silently breaks sync, backup or reset:

1. Type in `src/types/index.ts`.
2. Table in `database.ts` under a **new** `this.version(n + 1)` — never edit an existing version.
3. CRUD methods in `storage.ts` (wrapped in its retry helper).
4. A store in `src/stores/`, and its `load…()` added to `reloadAllStores.ts`.
5. Row mapping plus upsert/delete/pull in `cloudSync.ts`.
6. Table plus RLS policies in `supabase/schema.sql` (see `supabase.md`).
7. Include it in backup export/import (`src/utils/exportData.ts`) and in "delete all data".
8. Tests for the store and for the export round-trip.

## Changing existing data safely

- **Renaming or removing a persisted setting resets it for every existing user.** Prefer
  keeping the key. If a rename is unavoidable, add a `version` + `migrate` to the `persist`
  options that carries the old value over.
- New optional fields on synced records: add the column to `schema.sql` **and** to
  `OPTIONAL_COLUMNS` in `cloudSync.ts`, so projects that haven't re-run the schema degrade
  instead of breaking.
- IndexedDB data from older versions must keep loading. Treat new fields as optional when reading.

## Timers and time

Anything that counts down or measures elapsed time derives from a stored wall-clock
timestamp (`endsAt`, `startedAt`) and recomputes on each tick and on `visibilitychange`.
Never decrement a counter per tick: browsers throttle or suspend timers in the background.
See `src/stores/restTimer.ts`. Dates are local `YYYY-MM-DD` strings, not UTC ISO dates.
