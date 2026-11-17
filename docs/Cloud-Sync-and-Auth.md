# Cloud Sync and Auth

Cloud sync is optional. It uses Supabase for email-and-password sign-in and for a Postgres copy of the user's records. It is built for one person with a couple of devices, not for collaboration.

The header comment in `src/services/cloudSync.ts` is the authoritative description. Read it before changing sync.

## The model in one line

IndexedDB is the source of truth on the device. Supabase is the source of truth across devices.

## With the environment variables unset

`getSupabase()` in `src/services/supabaseClient.ts` returns `null` when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing. Everything else follows from that:

| Part | Behaviour when not configured |
| --- | --- |
| `isCloudEnabled()` | `false` |
| Every exported sync function | Returns immediately without doing anything |
| `useAuthStore` | `cloudEnabled` is `false`, `user` stays `null`, auth actions do nothing |
| Sign-in screen | Never shown |
| Profile | No cloud sync row, no change password, no sign out |
| Stores | Never call sync, because there is no signed-in user |

The rule from `.kiro/steering/supabase.md`: every sync function must be a safe no-op when Supabase is not configured. Never make a feature depend on being signed in.

## Auth

`src/stores/auth.ts` wraps Supabase Auth.

| Action | Notes |
| --- | --- |
| `init` | Reads the current session and subscribes to auth changes. Called once on boot. |
| `signUp`, `signIn` | Email and password. After sign-up the UI asks the user to confirm by email, then sign in. |
| `signOut` | |
| `sendPasswordReset` | Sends a reset link back to the app's own URL |
| `updatePassword` | Used by the recovery flow and by "Change password" |

Two details worth knowing:

- **No account enumeration.** The forgot-password form always shows the same confirmation, whether or not the address has an account, so it does not reveal which emails are registered (`src/components/auth/AuthGate.tsx`).
- **Recovery mode.** Following a reset link fires Supabase's `PASSWORD_RECOVERY` event. The app then shows only the "set a new password" screen until it is done (`src/components/auth/PasswordRecoveryGate.tsx`).

The sign-in screen has "Skip for now — use this device only", which sets `fittrack-skip-auth` in localStorage.

## How sync works

### Local first

The app loads from IndexedDB, then `syncWithCloud()` runs in the background. The stores reload only if the sync changed something. Sync is never awaited before showing data (`src/App.tsx`).

### Pushing: the outbox

Each store mutation calls `syncUpsertX` or `syncDeleteX` without awaiting it.

1. The operation is written to an outbox in localStorage (`fittrack-sync-queue`).
2. It is sent to Supabase straight away.
3. It leaves the outbox only when the send succeeds.

| Property | Why |
| --- | --- |
| One operation per record, the latest | Keeps the outbox small. Only the newest state matters. |
| Tagged with the user id | A queued change is only ever sent by the account that queued it. Entries left by app versions from before tagging carry no user id, so nothing says whose they are: `readQueue()` drops them rather than send them into whoever is signed in. The records themselves stay in IndexedDB. An unsent edit goes up the next time that record changes, and an unsent delete may need repeating if the record comes back from the cloud. |
| `push()` never throws | Callers do not await it, and a failed sync must not surface as an unhandled rejection mid-workout. |
| Retried by `flushQueue()` | Runs on app boot (as the first half of `syncWithCloud`) and on the browser's `online` event. |

The retry guarantee depends on the outbox write in step 1 succeeding. If localStorage rejects it (for example, it is full) **and** the immediate send also fails, `push()` logs and swallows both errors, so nothing is left to retry. The record is safe on the device but may not reach the cloud until it is edited again or a later pull finds the local copy newer than the cloud's.

### Deletes are tombstones

A delete writes a row to `deleted_records` (user, table name, record id, deletion time) and then removes the record's own row.

When another device pulls, it deletes its local copy of any record that has a tombstone. A record that is merely **absent** from the cloud is never deleted locally, because it may simply not have been uploaded yet. This is the reason tombstones exist: absence cannot tell "deleted" from "not synced yet".

### Pulling and conflicts

`pullAndHydrate()` fetches every table and the tombstones, then reconciles each table. Conflicts are **last write wins per record, on `updatedAt`**.

| Situation | Result |
| --- | --- |
| Cloud row is newer than the local record | Local record is replaced |
| Local record is newer than the cloud row | Local record is kept and pushed back up |
| Record exists only in the cloud | Saved locally |
| Tombstone at or after the record's last edit | Local record is deleted |
| A local delete is still waiting in the outbox | The cloud row is not brought back |
| Record exists only locally | Left alone (uploaded only after a backup restore, see below) |

Every mutation must therefore bump `updatedAt`.

If the cloud cannot be read, the pull throws before touching anything local, so a half-fetched pull is never applied.

### After a backup import

A backup might contain records that were deleted earlier and so have tombstones. Without special handling, the next sync would delete them again.

`markRestorePending()` sets a flag. On the next sync, the device's records win over tombstones: the tombstones are removed and records missing from the cloud are uploaded. The flag is cleared once that upload step finishes without an error.

Clearing the flag does not mean every restored record is now in the cloud:

- **Same-date collisions are skipped.** If a restored workout has the same date as a different workout already in the cloud, the upload hits a unique violation, `pushOutgoing()` skips that row, and the cloud's copy stands.
- **Newer cloud copies win.** The restore does not change last-write-wins: a restored record whose cloud copy has a newer `updatedAt` is replaced on the device by the cloud copy.

Keep the backup file until you have checked the restored data on another device.

Anything that writes records to IndexedDB in bulk without going through a store must call `markRestorePending()`.

### Deleting everything

`deleteAllCloudData()` writes a tombstone for every row and then deletes the rows, so the user's other devices clear their copies too. It also clears the outbox. The caller (`src/components/profile/DataAccountCard.tsx`) deletes the cloud first and the local copy second. If the cloud step fails, the device is left untouched.

That does not keep the two fully in step. Tables are cleared one at a time, so a failure partway through leaves the earlier tables already deleted in the cloud (with tombstones) while the device still has everything. Retrying the delete finishes the job; until then, other devices will drop the records from the tables that were cleared.

**Other devices can bring data back.** Tombstones only cover rows that are in the cloud when the delete runs. Another device's unsynced changes are not covered:

- Its outbox still holds them, and when that account next syncs there, `flushQueue()` uploads them. A record that was never uploaded before has no tombstone, so it reappears on every device; one that had been uploaded is recreated in the cloud but stays hidden while its tombstone is newer than its last edit.
- Signing out does not prevent this: `signOut()` leaves the outbox in place.
- A flush already in progress on another device works from its own copy of the outbox, so it can still upload after the delete. Nothing serialises the delete with other devices' syncs.

What to do today: run "delete all my data" on **every** device, each one online and showing as signed in. Each run deletes the cloud copy first and then clears that device's outbox, so whichever device goes last leaves the cloud empty. This covers the first two cases. It does not stop a flush that is already running on another device; nothing in the app can cancel that.

Avoid signing devices out as part of this. `signOut()` uses Supabase's default global scope, so signing out one device revokes the other devices' sessions too, and it can fail offline while the app still shows the user as signed out. A device whose session has quietly lapsed has no `user`, so the button skips the cloud step and still reports "All data deleted".

Making this safe automatically needs code changes:

- a per-account reset marker that devices check before flushing or applying a pull;
- making delete-all wait for a sync already running on the same device, since a pull that read the cloud before the delete can write its records back after the local clear;
- refusing to report success when the cloud step was skipped.

Deleting all data must also call `clearSyncQueue()`, so deleted records are not re-uploaded later.

## Table-driven design

Each synced table is one `SyncTable` entry in the `TABLES` object in `cloudSync.ts`: how to map a record to a row and back, and how to load, save and delete the local copy. Queueing, flushing, pulling and tombstones are generic over that description. Do not add per-table branches.

| Cloud table | Local type | Optional columns |
| --- | --- | --- |
| `exercises` | `Exercise` | `notes`, `rest_seconds` |
| `routines` | `Routine` (UI: program) | `weekly_templates` |
| `workout_templates` | `WorkoutTemplate` (UI: routine) | none |
| `workout_sessions` | `WorkoutSession` | `duration_seconds`, `planned_exercise_ids` |
| `body_weight_logs` | `BodyWeightLog` | none |
| `cardio_sessions` | `CardioSession` | none |
| `deleted_records` | tombstones | not a `SyncTable` |

Column names are `snake_case` and map explicitly to `camelCase` fields. Timestamps are `bigint` Unix milliseconds, matching local records.

## Degrading when the schema is behind

A Supabase project whose owner has not re-run `supabase/schema.sql` may lack newer columns or tables. Sync is written to degrade, not break.

| Missing | What happens |
| --- | --- |
| An optional column | The upsert is retried without the optional columns. On pull, the local value for that field is kept. |
| A whole table | That table's local records are left alone. |
| `deleted_records` | Deletes still happen, but do not reach other devices. |

So until the schema is re-run, newer data stays on the device that created it, and a delete on one device does not remove the record from the others.

## The cloud schema

`supabase/schema.sql`.

- Every table has `user_id uuid not null references auth.users(id) on delete cascade`.
- **Row-level security is enabled on every table**, including `deleted_records`.
- Each table has one policy, `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`. A user can only read and write their own rows.
- `workout_sessions` and `body_weight_logs` have `unique (user_id, date)`: one row per user per day.
- The file ends with `notify pgrst, 'reload schema'` so the API sees new tables and columns immediately.

The unique constraint has one visible effect in sync. If two devices each logged the same date under different ids, the upload of the second one hits a unique violation. `pushOutgoing` skips that row rather than failing the batch, and the cloud's copy stands.

### Keeping the schema re-runnable

The file must stay safe to run again and again (`.kiro/steering/supabase.md`):

- `create table if not exists`
- `alter table … add column if not exists`
- `create or replace`
- drop-then-create for policies
- Never a destructive migration such as `drop table` or `drop column`.

## Secrets

- Only the public anon key is used in the client. Row-level security is what makes that safe.
- Never put a service-role key anywhere in this repo or the client bundle. It bypasses row-level security.
- Keys live in `.env.local`, which is gitignored, and in GitHub repo secrets for the deploy workflow. `.env.example` lists the names with empty values.
- If a real key is ever committed, removing it is not enough. It has to be rotated.

## Testing sync

Mock `./supabaseClient` in `cloudSync` tests and never hit the network. See `src/services/cloudSync.test.ts` and [Testing](Testing.md).

## TODO

- TODO: confirm the Supabase Auth settings the app expects (email confirmation on or off, allowed redirect URLs for password reset). They are configured in the Supabase dashboard, not in this repo.
- TODO: confirm how a user's Supabase account itself is deleted. The app deletes the user's rows; `public/privacy.html` says account deletion is by request.
