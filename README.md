# FitTrack

A mobile-first fitness tracking PWA. Data is stored locally in the browser via IndexedDB
and works fully offline — cloud sync and multi-device auth are entirely optional add-ons.
Installable to a phone's home screen like a native app (manifest + service worker via
`vite-plugin-pwa`).

## Screens

- **Home** — today's plan at a glance, training streak, week completion, latest body weight, and a shortcut into Train.
- **Train** — the daily checklist, plus a guided session mode that walks through pending exercises one at a time with a rest timer between sets and a completion summary. Any routine can be done on any day from here, replacing or adding to what was scheduled. Cardio sessions (run, ride, row, swim and more, with distance, pace, heart rate and calories) are logged here too.
- **Library** — a searchable, filterable catalog of exercises; tapping one lets you add it straight to today's plan.
- **Progress** — this week's completion and cardio totals at a glance, a per-exercise weight/reps/completion chart picker with personal records, and the body weight trend (with its own log-entry form).
- **Profile** — lifetime stats, routines (reusable exercise lists like “Push Day”: create, edit, reorder, duplicate, delete), the weekly plan builder (assign routines and single exercises to days, with multiple switchable programs), exercise management, workout preferences (units, rest timer length/sound/vibration, keep-screen-awake, notifications), and data & account (backup export/import, change password, privacy policy, delete all data).
- **Onboarding** — a first-launch, three-step introduction (shown once per device).

Design system: dark, teal accent, outlined buttons — see [src/index.css](./src/index.css) for the token set.

## Tech stack

React 19 + TypeScript, Vite, Tailwind CSS v4, Zustand for state, Dexie (IndexedDB) for
local storage, Chart.js for charts, and Supabase for optional auth/cloud sync.

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # type-check + production build
npm run test      # run the test suite once
npm run test:watch
npm run lint
```

## Installing on your phone

Installing a PWA needs the app served over HTTPS. [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)
builds and publishes it to GitHub Pages on every push to `main` (one-time setup: repo
Settings → Pages → Source: **GitHub Actions**). It is then live at
`https://<user>.github.io/FitTrack-React/`.

- **iPhone** — open the URL in Safari → Share → **Add to Home Screen**.
- **Android** — open the URL in Chrome → tap **Install** on the in-app banner (or ⋮ → **Install app**).

Hosting at a domain root instead (Vercel, Netlify, …) needs no config: the build defaults
to `/`, and `BASE_PATH` is only set by the Pages workflow.

## Running on the iOS simulator

Needs Xcode and CocoaPods.

```bash
npm run ios        # build, sync, and launch the app on the simulator
npm run ios:live   # same, but served from the Vite dev server: edits appear as you save
```

`ios:live` points the native app at `http://localhost:5173`, so it keeps its own separate
data and only works while the command is running. Run `npm run ios` afterwards to put a
normal bundled build back on the simulator.

## Cloud Sync (optional)

The app runs fully local-only with zero configuration — no `.env` file needed. To enable optional cross-device sync and sign-in via Supabase:

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project (Settings → API), and apply [supabase/schema.sql](./supabase/schema.sql) in the SQL Editor (creates the tables and row-level-security policies). The file is safe to re-run, and should be re-run after pulling changes that touch it — until then, newer data such as routines stays on the device that created it instead of syncing. Leave both env vars unset to run fully offline/local — the app behaves identically either way, just without an auth gate or cross-device sync. `.env.local` is gitignored — never commit your Supabase keys.

## Testing

Vitest + Testing Library. Unit tests cover the pure calculation/util functions; e2e-style
component tests drive real user flows (rendering, clicking, typing) rather than testing
implementation details.

## CI

[.github/workflows/ci.yml](./.github/workflows/ci.yml) runs lint, test, and build on every push/PR to `main`.

## Privacy

[public/privacy.html](./public/privacy.html), linked from the sign-in screen, describes what
data is stored locally vs. in the cloud (only if you create an account) and how to delete it.
