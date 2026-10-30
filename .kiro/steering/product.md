---
inclusion: always
---

# Product: FitTrack

FitTrack is a mobile-first fitness tracker for one person training on their own phone.
It ships as an installable PWA (GitHub Pages) and as native iOS/Android apps (Capacitor).

## Principles — these override convenience

- **Offline-first, local-first.** All data lives on the device in IndexedDB and every feature
  must work with no network and no account. Never block the UI on a network request.
- **Cloud sync is optional.** Supabase auth/sync only exists when `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` are set. With them unset the app must behave identically, just
  without sign-in or cross-device sync. Never make a feature depend on being signed in.
- **Phone first.** Design for one-handed use mid-workout on a small screen: big tap targets,
  minimal typing, sensible defaults, nothing that needs hover. Desktop is secondary.
- **Respect the user's data.** No analytics or third-party tracking. Destructive actions need a
  confirmation step. Backup export/import must keep covering every kind of stored data.
  `public/privacy.html` describes what is stored where — update it if that changes.

## Screens (bottom-nav tabs)

- **Home** — today's plan, training streak, week completion, latest body weight.
- **Train** — the daily checklist, guided session mode (log → rest → next, with supersets), and
  cardio logging. Any routine can be done on any day.
- **Library** — searchable exercise catalog (built-in plus the user's own exercises); add to today's plan.
- **Progress** — weekly completion and cardio totals, per-exercise charts with personal records,
  body weight trend.
- **Profile** — lifetime stats, routines (reusable exercise lists), weekly plan builder with
  switchable programs, preferences, data & account.
- **Onboarding** — a three-step intro shown once per device.

## Vocabulary

The UI and the code use different words for some things — keep both straight:

| UI term | Code / storage |
| --- | --- |
| Routine (e.g. "Push Day") | `WorkoutTemplate`, `workoutTemplates` table / store |
| Program / weekly plan | `Routine`, `routine` table, `isActive` marks the current one |
| Workout / session | `WorkoutSession`, one per date |
