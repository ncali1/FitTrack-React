# Privacy and Data

What FitTrack stores, where it goes, and how to remove it. The user-facing policy is `public/privacy.html`, linked from the sign-in screen and from Profile. This page describes what the code does.

## The short version

- Without an account, nothing leaves your device.
- With an account, your workout records and your email address are stored in Supabase.
- There are no analytics, no advertising trackers and no ads.

## What is stored where

| Data | On the device | In the cloud (only if signed in) |
| --- | --- | --- |
| Exercises you created or added | IndexedDB | `exercises` |
| Routines | IndexedDB | `workout_templates` |
| Weekly programs | IndexedDB | `routines` |
| Workout sessions and logged sets | IndexedDB | `workout_sessions` |
| Cardio sessions | IndexedDB | `cardio_sessions` |
| Body weight entries | IndexedDB | `body_weight_logs` |
| Email address and password | Not stored by the app | Supabase Auth |
| Deletion markers | No | `deleted_records` |
| Preferences (units, rest timer, sound, vibration, keep awake, reminders, Library layout) | localStorage | Never |
| When you last backed up, and when you snoozed the reminder | localStorage | Never |
| An in-progress guided workout | localStorage, until it is finished or replaced. The 12 hours is a resume limit, not a retention limit: an older session is ignored when the app opens, but the stored copy stays until the guided-session state next changes. | Never |
| Flags: onboarding seen, sign-in skipped, install banner dismissed, last nudge date | localStorage | Never |
| Changes waiting to sync | localStorage, until sent | They become the rows above |
| Sign-in session | Browser storage, managed by the Supabase client | |

Sources: `src/services/database.ts`, `src/services/cloudSync.ts`, `src/stores/settings.ts`, `src/stores/guidedSession.ts`, `supabase/schema.sql`. The localStorage keys are listed in [Data Model and Storage](Data-Model-and-Storage.md#localstorage-keys).

The onboarding goal you pick is not stored anywhere.

## Deletion markers

When you delete a record while signed in, the record itself is removed from the cloud. A small marker stays: the record's random id, which table it was in, and when it was deleted. It holds none of the record's contents. It exists so your other devices know to remove their copy. See [Cloud Sync and Auth](Cloud-Sync-and-Auth.md#deletes-are-tombstones).

## Who can read cloud data

Every cloud table has row-level security with a single policy: a row is readable and writable only when `auth.uid() = user_id`. A signed-in user can reach only their own rows (`supabase/schema.sql`).

## What the app does not do

- No third-party analytics or advertising trackers.
- No ads.
- No network requests are needed to use the app. With cloud sync off, the app makes none for your data.

## Protecting data you have not backed up

Browsers can clear a site's stored data when a device runs low on space, or after a long time without a visit. FitTrack asks the browser to keep its data. The browser decides, and Profile shows the answer under "Device storage". If you train without an account and have not exported a backup in 30 days, Home reminds you. See the [User Guide](User-Guide.md#backups).

## Your controls

| You want to | How |
| --- | --- |
| Use the app with no account | Choose "Skip for now" on the sign-in screen. On a build without cloud sync there is no sign-in screen at all. |
| Take a copy of your data | Profile → Data & account → Export, or the gear icon → Backup → Export |
| Move data to another device without an account | Export on one device, Import on the other |
| Sign out | Profile → Sign out, or the account menu in the top bar |
| Delete everything | Profile → Data & account → Delete all my data. Removes all records on the device, and in your cloud account if you are signed in. |
| Remove local data only | Clear the browser's site data for the app |
| Delete your account itself | By request, using the contact address in `public/privacy.html` |

Two details about "Delete all my data" (`src/components/profile/DataAccountCard.tsx`):

- If you are signed **out** when you use it, anything already synced to your account stays there and returns when you sign in. The confirmation says so.
- It removes records. It does not remove the Supabase account, and it does not reset per-device preferences.

## Keeping this page and the policy true

`.kiro/steering/product.md` says `public/privacy.html` must be updated whenever what is stored, or where, changes. The same applies to this page. The checklist for a new kind of record in [Data Model and Storage](Data-Model-and-Storage.md#adding-a-new-kind-of-record) includes it.

## Known gaps in the policy text

- `public/privacy.html` lists exercises, the weekly routine, workout sessions and body weight logs as stored locally. It does not mention cardio sessions or routines, which the app also stores and syncs.
- TODO: confirm whether Supabase project region and data retention should be stated in the policy. Neither is recorded in the repo.
