# FitTrack

A mobile-first fitness tracking PWA. Data is stored locally in the browser via IndexedDB
and works fully offline — cloud sync and multi-device auth are entirely optional add-ons.
Installable to a phone's home screen like a native app (manifest + service worker via
`vite-plugin-pwa`).

## Screens

- **Home** — today's plan at a glance, training streak, week completion, latest body weight, and a shortcut into Train.
- **Train** — the daily checklist, plus a guided session mode that walks through pending exercises one at a time with a rest timer between sets and a completion summary.
- **Library** — a searchable, filterable catalog of exercises; tapping one lets you add it straight to today's plan.
- **Progress** — this week's completion at a glance, a per-exercise weight/reps/completion chart picker with personal records, and the body weight trend (with its own log-entry form).
- **Profile** — routine management (create/rename/switch/delete), the weekly plan builder, exercise management, and quick settings (units, rest timer, notifications, cloud sync status).
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

## Cloud Sync (optional)

The app runs fully local-only with zero configuration — no `.env` file needed. To enable optional cross-device sync and sign-in via Supabase:

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project (Settings → API), and apply [supabase/schema.sql](./supabase/schema.sql) in the SQL Editor (creates the tables and row-level-security policies). Leave both env vars unset to run fully offline/local — the app behaves identically either way, just without an auth gate or cross-device sync. `.env.local` is gitignored — never commit your Supabase keys.

## Testing

Vitest + Testing Library. Unit tests cover the pure calculation/util functions; e2e-style
component tests drive real user flows (rendering, clicking, typing) rather than testing
implementation details.

## CI

[.github/workflows/ci.yml](./.github/workflows/ci.yml) runs lint, test, and build on every push/PR to `main`.

## Privacy

[public/privacy.html](./public/privacy.html), linked from the sign-in screen, describes what
data is stored locally vs. in the cloud (only if you create an account) and how to delete it.
