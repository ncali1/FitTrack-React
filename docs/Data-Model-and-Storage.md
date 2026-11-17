# Data Model and Storage

What FitTrack stores, where, and in what shape.

## The vocabulary trap

The UI and the code disagree on two names. Keep this table next to you.

| UI term | Code type | IndexedDB table | Store | Cloud table |
| --- | --- | --- | --- | --- |
| Routine ("Push Day") | `WorkoutTemplate` | `workoutTemplates` | `useWorkoutTemplatesStore` | `workout_templates` |
| Program / weekly plan | `Routine` | `routine` | `useRoutineStore` | `routines` |
| Workout / session | `WorkoutSession` | `workoutSessions` | `useWorkoutSessionsStore` | `workout_sessions` |

Why: `Routine` was the weekly plan's name first, and that name is baked into persisted table names. When reusable exercise lists arrived, the UI called them routines, so the code had to pick another word (`src/types/index.ts`).

In practice: user-facing strings say "routine" and "program". Code, table names and error variables say `WorkoutTemplate` and `Routine`. `storageService.saveRoutine` saves a program.

## Three places data lives

| Kind | Where | Synced | In backups |
| --- | --- | --- | --- |
| Workout data: the user's records | IndexedDB, through Dexie | Yes, if signed in | Yes |
| Per-device preferences | localStorage | No | No |
| In-progress guided workout | localStorage | No | No |

Preferences are per-device facts, not workout data. The comment in `src/stores/settings.ts` gives the example: a backup made on one phone says nothing about another.

## Domain types

All in `src/types/index.ts`. Every stored record has a string `id` and `createdAt` / `updatedAt` in Unix milliseconds.

### `Exercise`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | |
| `targetSets`, `targetReps` | number | |
| `targetMuscleGroups` | string[] | Names from `MUSCLE_GROUP_OPTIONS` in `src/components/exercises/ExerciseForm.tsx` |
| `notes` | string, optional | Form cues, a video link |
| `restSeconds` | number, optional | Overrides the default rest for this exercise |

### `WorkoutTemplate` (UI: routine)

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | |
| `exerciseIds` | string[] | Ordered |

### `Routine` (UI: program)

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | |
| `isActive` | boolean | The program driving the daily checklist |
| `weeklyAssignments` | `{ [day]: exerciseId[] }` | Exercises assigned to a day individually. Keys are lowercase day names. |
| `weeklyTemplates` | `{ [day]: templateId[] }`, optional | Routines assigned to a day, in order. Absent on plans saved before routines existed. |

A day's actual plan is computed by `resolveRoutine` in `src/stores/routine.ts`: each assigned routine's exercises in order, then the individual exercises, without duplicates. Anything that displays or computes from a plan should read the resolved form, for example through `useActiveProgram()`.

### `WorkoutSession`

One per date.

| Field | Type | Notes |
| --- | --- | --- |
| `date` | string | Local `YYYY-MM-DD` |
| `exercises` | `ExercisePerformance[]` | One entry per exercise logged that day |
| `durationSeconds` | number, optional | Set once when a guided session finishes |
| `plannedExerciseIds` | string[], optional | When set, replaces the weekly program's plan for this date |

`plannedExerciseIds` is a snapshot of ids, not a reference to a routine. The type's comment gives the reason: later edits to the routine must not rewrite history.

### `ExercisePerformance`

Embedded in a session, not a table of its own.

| Field | Type | Notes |
| --- | --- | --- |
| `exerciseId` | string | |
| `completed` | boolean | |
| `actualSets`, `actualReps` | number, optional | |
| `weight` | number, optional | Kilograms. Omitted for bodyweight. |
| `difficultyLevel` | `'easy' \| 'moderate' \| 'hard'`, optional | |
| `rpe` | number, optional | 6 to 10 in half steps |
| `isWarmup` | boolean, optional | Excluded from records, volume, muscle balance, 1RM and suggestions |
| `timestamp` | number | Unix milliseconds |

### `CardioSession`

Several can share a date.

| Field | Type | Notes |
| --- | --- | --- |
| `date` | string | Local `YYYY-MM-DD` |
| `type` | `CardioType` | run, walk, cycle, row, swim, elliptical, stairs, hike, hiit, other |
| `durationSeconds` | number | |
| `distanceKm` | number, optional | Always kilometres |
| `avgHeartRate`, `calories` | number, optional | |
| `notes` | string, optional | |

### `BodyWeightLog`

| Field | Type | Notes |
| --- | --- | --- |
| `date` | string | Logging again on the same date overwrites the entry |
| `weightKg` | number | Always kilograms |

### Units

Weights are stored in kilograms and distances in kilometres. Conversion happens only at render time, through `src/utils/units.ts` and `src/utils/cardio.ts`. Never display a raw stored value.

## IndexedDB (Dexie)

Defined in `src/services/database.ts`. Database name: `FitnessTrackerDB`.

| Dexie version | Tables added | Indexes |
| --- | --- | --- |
| 1 | `exercises` | `++id` |
| 1 | `routine` | `++id, isActive` |
| 1 | `workoutSessions` | `++id, date` |
| 1 | `bodyWeightLogs` | `++id, date` |
| 2 | `workoutTemplates` | `++id` |
| 3 | `cardioSessions` | `++id, date` |

The primary key is declared `++id`, but the stores always supply their own UUID.

All access goes through `storageService` in `src/services/storage.ts`. It deep-clones each record to a plain object before writing, retries transient failures, and throws `StorageQuotaError` when storage is full.

**Never edit an existing `this.version(n)` block.** Add a new `this.version(n + 1)`. Devices in the field are already on the old versions.

## localStorage keys

| Key | Written by | Holds |
| --- | --- | --- |
| `fittrack-settings` | `src/stores/settings.ts` | Preferences, `lastBackupAt`, `backupReminderSnoozedAt` |
| `fittrack-guided-session` | `src/stores/guidedSession.ts` | The in-progress guided workout. Dropped after 12 hours. |
| `fittrack-sync-queue` | `src/services/cloudSync.ts` | The sync outbox |
| `fittrack-sync-restore-pending` | `src/services/cloudSync.ts` | Flag set after a backup import |
| `fittrack-skip-auth` | `src/App.tsx` | The sign-in screen was skipped on this device |
| `fittrack-onboarding-complete` | `src/App.tsx` | Onboarding was seen |
| `fittrack-last-nudge-date` | `src/components/widgets/WorkoutReminder.tsx` | Date the workout nudge last showed |
| `fittrack-install-dismissed-at` | `src/components/widgets/InstallPrompt.tsx` | When the install banner was dismissed |

When cloud sync is configured, the Supabase client also keeps its auth session in browser storage (`persistSession: true` in `src/services/supabaseClient.ts`).

### Settings fields

From `src/stores/settings.ts`:

| Field | Type | Default |
| --- | --- | --- |
| `weightUnit` | `'kg' \| 'lb'` | `'kg'` |
| `distanceUnit` | `'km' \| 'mi'` | `'km'` |
| `restDuration` | seconds | `90` |
| `remindersEnabled` | `boolean \| null` | `null`, meaning never asked |
| `restTimerSound` | boolean | `false` |
| `restTimerVibrate` | boolean | `true` |
| `keepScreenAwake` | boolean | `true` |
| `libraryView` | `'list' \| 'grid'` | `'list'` |
| `lastBackupAt` | ms or `null` | `null` |
| `backupReminderSnoozedAt` | ms or `null` | `null` |

Renaming or removing a persisted setting resets it for every existing user. Keep the key. If a rename is unavoidable, add `version` and `migrate` to the `persist` options to carry the old value over (`.kiro/steering/state-and-storage.md`).

## Backup format

Defined in `src/utils/exportData.ts`. A backup is one JSON file named `fittrack-backup-YYYY-MM-DD.json`.

```ts
interface Backup {
  version: number            // BACKUP_VERSION, currently 3
  exportedAt: string         // ISO timestamp
  exercises: Exercise[]
  routines: Routine[]                    // programs
  workoutTemplates?: WorkoutTemplate[]   // routines; absent in version 1
  workoutSessions: WorkoutSession[]
  bodyWeightLogs: BodyWeightLog[]
  cardioSessions?: CardioSession[]       // absent in versions 1 and 2
}
```

| Behaviour | Detail |
| --- | --- |
| Validation | `readBackupFile` checks that `version` is a number, `exportedAt` is a string, and each list is an array of objects. Anything else throws `InvalidBackupError`. |
| Restore is a merge | `restoreBackup` upserts each record by id. Nothing already stored but absent from the file is deleted. |
| Body weight merges by date | `saveBodyWeightLog` keeps one entry per date. A backup entry whose date matches an existing local entry overwrites that entry's weight, even if the ids differ. |
| Older files | The two optional lists default to empty, so version 1 and 2 files still import. |
| Not included | Preferences and the in-progress guided workout. |

After an import, `BackupControls.tsx` reloads the stores, calls `markRestorePending()` so the next sync uploads the restored records, and calls `markBackedUp()`. The upload covers records the cloud lacks and records newer than their cloud copy; a restored record whose cloud copy is newer is replaced by the cloud copy (see [Cloud Sync and Auth](Cloud-Sync-and-Auth.md#after-a-backup-import)).

Anything that exports or restores a backup must call `markBackedUp()`. For exports, use the `useBackupExport()` hook rather than calling `downloadBackup()` directly.

## Protecting the local copy

Without an account, IndexedDB on one device is the only copy of someone's history. Two things guard it.

| Guard | How it works | Where |
| --- | --- | --- |
| Eviction | `navigator.storage.persist()` asks the browser to keep the data. It is requested after the first successful save of each page load. | `src/services/persistentStorage.ts`, called from `afterSave()` in `storage.ts` |
| Backup reminder | Home shows a notice when a signed-out device has gone 30 days without an export | `src/utils/backupReminder.ts` |

Why the request waits for a save instead of running at launch: Firefox shows a permission prompt for it. After a save there is something worth keeping, and the request follows a tap, so the prompt does not greet a first-time visitor.

## Adding a new kind of record

The full checklist from `.kiro/steering/state-and-storage.md`. Missing any step silently breaks sync, backup or reset.

1. Type in `src/types/index.ts`.
2. Table in `database.ts` under a **new** `this.version(n + 1)`.
3. CRUD methods in `storage.ts`, wrapped in its retry helper. Add the table to `clearAllData`.
4. A store in `src/stores/`, with its `load…()` added to `reloadAllStores.ts` and to `useAppInitialization.ts`.
5. A `SyncTable` entry in `TABLES`, and `syncUpsertX` / `syncDeleteX` exports, in `cloudSync.ts`.
6. Table plus row-level security policy in `supabase/schema.sql`.
7. Include it in backup export and import (`src/utils/exportData.ts`) and in "delete all data".
8. Tests for the store and for the export round-trip.
9. Update `public/privacy.html` if what is stored has changed (`.kiro/steering/product.md`).

## Changing existing data safely

- **New optional field on a synced record**, all in the same change:
  1. Add the column to `schema.sql`.
  2. In `cloudSync.ts`, add the column to that table's row type, write it in `toRow`, read it in `fromRow`, and list it in `optionalColumns`. Without the `toRow`/`fromRow` mappings the field saves locally but never reaches other devices.

  Projects that have not re-run the schema then degrade instead of breaking: the upload is retried without the optional columns. That fallback has a cost. The operation counts as sent and leaves the outbox, so once the schema is updated, records whose `updatedAt` did not change are not uploaded again, and the field stays missing on other devices until each record is edited.
- **Old IndexedDB data must keep loading.** Treat new fields as optional when reading.

## Related pages

- [Cloud Sync and Auth](Cloud-Sync-and-Auth.md) for the cloud schema and sync rules.
- [Privacy and Data](Privacy-and-Data.md) for the user-facing view of the same facts.
