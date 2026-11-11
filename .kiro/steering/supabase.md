---
inclusion: fileMatch
fileMatchPattern: ["supabase/**", "src/services/cloudSync.ts", "src/services/supabaseClient.ts", "src/stores/auth.ts"]
---

# Supabase (optional cloud sync)

Read the header comment in `src/services/cloudSync.ts` before changing sync. In short:
IndexedDB is the source of truth on the device; Supabase is the source of truth across devices.

- **Local first.** The app loads from IndexedDB, then `syncWithCloud()` runs in the background
  and the stores reload only if it changed something. Never await sync before showing data.
- **Outbox.** Every push is queued in localStorage first and removed once it succeeds, one op
  per record (latest wins), tagged with the user it belongs to. It is retried on boot and on `online`.
- **Deletes are tombstones.** A delete writes a row to `deleted_records` and removes the record's
  row. A pull deletes local records that have a tombstone — never ones that are merely absent
  from the cloud.
- **Last write wins per record, on `updatedAt`.** A pull takes newer cloud rows, keeps newer local
  records and pushes them back up. Every mutation must therefore bump `updatedAt`.
- **Table-driven.** Each table is one `SyncTable` entry in `TABLES`; don't add per-table branches.

## Rules

- Every sync function must be a safe no-op when Supabase isn't configured.
- **`supabase/schema.sql` must stay re-runnable.** Use `create table if not exists`,
  `alter table … add column if not exists`, `create or replace`, and drop-then-create for policies.
  Never write a destructive migration (`drop table`, `drop column`) into it.
- Every table has `user_id uuid not null references auth.users(id) on delete cascade`,
  **row-level security enabled**, and policies limiting all access to `auth.uid() = user_id`.
- Column names are `snake_case` and map explicitly to `camelCase` fields in `cloudSync.ts`.
  Timestamps are `bigint` Unix milliseconds, matching the local records.
- A column added to an existing table also goes into that table's `optionalColumns` in `cloudSync.ts`,
  and the README note about re-running the schema still applies.
- Anything that writes records to IndexedDB in bulk without going through a store (backup
  import) must call `markRestorePending()` so the next sync uploads them.
- Deleting all data must also clear the sync queue (`clearSyncQueue`) so deleted records
  aren't re-uploaded.

## Secrets

- Only the public anon key is used in the client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  Never put a service-role key anywhere in this repo or the client bundle.
- Keys live in `.env.local` (gitignored) and in GitHub repo secrets for the deploy workflow.
  `.env.example` lists the names with empty values. Never commit real values.
