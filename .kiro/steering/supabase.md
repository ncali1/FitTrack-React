---
inclusion: fileMatch
fileMatchPattern: ["supabase/**", "src/services/cloudSync.ts", "src/services/supabaseClient.ts", "src/stores/auth.ts"]
---

# Supabase (optional cloud sync)

Read the header comment in `src/services/cloudSync.ts` before changing sync. In short:
IndexedDB is the source of truth on the device; Supabase is the source of truth across devices.
Pushes are fire-and-forget, failures queue in localStorage and retry on boot and on `online`,
and sign-in or boot pulls everything and overwrites the local cache (last write wins per row).

## Rules

- Every sync function must be a safe no-op when Supabase isn't configured.
- **`supabase/schema.sql` must stay re-runnable.** Use `create table if not exists`,
  `alter table … add column if not exists`, `create or replace`, and drop-then-create for policies.
  Never write a destructive migration (`drop table`, `drop column`) into it.
- Every table has `user_id uuid not null references auth.users(id) on delete cascade`,
  **row-level security enabled**, and policies limiting all access to `auth.uid() = user_id`.
- Column names are `snake_case` and map explicitly to `camelCase` fields in `cloudSync.ts`.
  Timestamps are `bigint` Unix milliseconds, matching the local records.
- A column added to an existing table also goes into `OPTIONAL_COLUMNS` in `cloudSync.ts`,
  and the README note about re-running the schema still applies.
- Deleting all data must also clear the sync queue (`clearSyncQueue`) so deleted records
  aren't re-uploaded.

## Secrets

- Only the public anon key is used in the client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  Never put a service-role key anywhere in this repo or the client bundle.
- Keys live in `.env.local` (gitignored) and in GitHub repo secrets for the deploy workflow.
  `.env.example` lists the names with empty values. Never commit real values.
