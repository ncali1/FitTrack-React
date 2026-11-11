# FitTrack

**A gym logbook for your phone. Offline-first, no account needed, nothing tracked.**

[![CI](https://github.com/ncali1/FitTrack-React/actions/workflows/ci.yml/badge.svg)](https://github.com/ncali1/FitTrack-React/actions/workflows/ci.yml)
[![Deploy](https://github.com/ncali1/FitTrack-React/actions/workflows/deploy.yml/badge.svg)](https://github.com/ncali1/FitTrack-React/actions/workflows/deploy.yml)
![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Capacitor 8](https://img.shields.io/badge/Capacitor-8-119eff?logo=capacitor&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-ff5b1f)

**[Try it live →](https://ncali1.github.io/FitTrack-React/)**

FitTrack is a mobile-first fitness tracker for one person training on their own phone. It
ships as an installable PWA and as native iOS and Android apps (Capacitor). All of your data
lives on the device in IndexedDB, so every feature works in airplane mode. Cloud sync across
devices is there if you want it and invisible if you don't.

## Highlights

- **Guided sessions.** Log a set, rest, move on. The app walks you through the day's
  exercises (supersets included) with a rest timer that survives the screen locking, then
  alerts you by sound, vibration or notification when rest is over.
- **Smart logging.** Each exercise suggests your next weight and reps from your history,
  builds a warm-up ramp, and shows which plates to load on the bar.
- **Swap on the fly.** Machine taken? Swap the current exercise for a similar one mid-session.
- **3D exercise previews.** A 3D figure loops one rep of the movement with the target
  muscles highlighted. It falls back to a 2D muscle diagram where WebGL isn't available.
- **Cardio too.** Runs, walks, rides, rows, swims, hikes, HIIT and more, with distance,
  pace, heart rate and calories.
- **Progress you can see.** Per-exercise charts, personal records, estimated one-rep max,
  muscle balance, and a body weight trend.
- **Your data stays yours.** No analytics, no third-party tracking, and a backup
  export/import that covers everything the app stores.

## Screens

| Tab | What's there |
| --- | --- |
| **Home** | Today's plan at a glance, training streak, week completion, latest body weight, and a shortcut into Train. |
| **Train** | The daily checklist and guided session mode, with a completion summary at the end. Any routine can be done on any day, replacing or adding to what was scheduled. Cardio is logged here too. |
| **Library** | A searchable, filterable catalog of built-in exercises plus your own. Switch between a ruled list and a grid of 3D figure tiles, add custom exercises, and add any exercise to today's plan or to a routine. |
| **Progress** | This week's completion and cardio totals, a per-exercise weight/reps/completion chart picker with personal records and estimated 1RM, muscle balance, and the body weight trend with its own log form. |
| **Profile** | Lifetime stats, routines (reusable exercise lists like "Push Day": create, edit, reorder, duplicate, delete), the weekly plan builder with multiple switchable programs, preferences (units, rest timer length/sound/vibration, keep-screen-awake, notifications), and data & account (backup export/import, cloud sync, change password, privacy policy, delete all data). |
| **Onboarding** | A three-step intro shown once per device. |

## Design

The look is a **training log**: a paper gym logbook rendered dark. Warm near-black pages,
chalk-white ink, hairline rules instead of floating cards, condensed uppercase headings,
monospace numbers, near-square corners, no shadows or gradients.

Colour carries meaning and is kept to two signals: **orange** means you can act on it,
**chalk yellow** means it's done or worth celebrating. Everything else is neutral. The full
token set is in [src/index.css](./src/index.css).

## Tech stack

| Layer | Tools |
| --- | --- |
| App | React 19, TypeScript (strict), Vite |
| Styling | Tailwind CSS v4 with design tokens, Archivo and JetBrains Mono |
| State and storage | Zustand, Dexie (IndexedDB) for workout data, localStorage for preferences |
| Visuals | Chart.js, three.js, lucide-react, sonner |
| Native and PWA | Capacitor 8 (haptics, local notifications, keep-awake), vite-plugin-pwa |
| Cloud (optional) | Supabase auth and Postgres with row-level security |
| Quality | Vitest, Testing Library, oxlint, GitHub Actions |

## Getting started

```bash
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # type-check + production build
npm run test         # run the test suite once
npm run test:watch   # tests in watch mode
npm run lint         # oxlint
```

No `.env` file is needed. Out of the box the app runs fully local.

## Installing on your phone

Installing a PWA needs the app served over HTTPS. [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)
builds and publishes it to GitHub Pages on every push to `main` (one-time setup in a fork:
repo Settings → Pages → Source: **GitHub Actions**). It is then live at
`https://<user>.github.io/FitTrack-React/`.

- **iPhone:** open the URL in Safari → Share → **Add to Home Screen**.
- **Android:** open the URL in Chrome → tap **Install** on the in-app banner (or ⋮ → **Install app**).

Hosting at a domain root instead (Vercel, Netlify, …) needs no config: the build defaults
to `/`, and `BASE_PATH` is only set by the Pages workflow.

## Running the native apps

### iOS simulator

Needs Xcode and CocoaPods.

```bash
npm run ios        # build, sync, and launch the app on the simulator
npm run ios:live   # same, but served from the Vite dev server: edits appear as you save
```

`ios:live` points the native app at `http://localhost:5173`, so it keeps its own separate
data and only works while the command is running. Run `npm run ios` afterwards to put a
normal bundled build back on the simulator.

### Android

Needs Android Studio.

```bash
npm run build
npx cap sync android
npx cap open android   # then run it from Android Studio
```

Run `npx cap sync` after adding or removing a Capacitor plugin or changing native config.

## Cloud sync (optional)

To enable sign-in and cross-device sync via Supabase:

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project
(Settings → API), and apply [supabase/schema.sql](./supabase/schema.sql) in the SQL Editor.
It creates the tables and their row-level-security policies. For the GitHub Pages build, add
the same two values as repo secrets.

The schema file is safe to re-run, and should be re-run after pulling changes that touch it.
Until then, newer data such as routines stays on the device that created it instead of
syncing, and deleting something on one device doesn't remove it from the others.

Leave both variables unset and the app behaves identically, just without sign-in or sync.
`.env.local` is gitignored. Never commit your Supabase keys.

### How sync works

Sync is built for one person with a couple of devices, not for collaboration:

- **Local first.** The app loads from IndexedDB straight away and syncs in the background.
  The UI never waits on the network.
- **Outbox.** Every change is queued on the device and removed once it reaches the cloud, so
  a failed push is retried on the next launch or when the connection comes back.
- **Deletes propagate.** A delete leaves a tombstone, so your other devices remove their
  copy too. A record that is merely missing from the cloud is never deleted locally.
- **Last write wins.** Conflicts resolve per record on its last-updated time.

## Project layout

```
src/
  components/<feature>/   UI grouped by feature: checklist, cardio, library, progress, profile, …
  stores/                 Zustand stores, one per domain
  services/               Side effects and platform access: Dexie, cloud sync, rest alerts
  hooks/                  Reusable React hooks
  utils/                  Pure functions: calculations, units, personal records, plate maths, …
  data/                   The built-in exercise catalog
  types/index.ts          Shared domain types
supabase/schema.sql       Cloud schema + row-level security
ios/, android/            Capacitor native projects
public/                   Static assets, icons, privacy.html
```

Conventions for contributors and AI assistants live in [.kiro/steering/](./.kiro/steering/).
`CLAUDE.md` imports the same files.

## Testing and CI

Vitest and Testing Library on happy-dom, with tests next to the code they cover:

- `foo.test.ts` covers pure functions and store logic.
- `Foo.e2e.test.tsx` drives real user flows (render, click, type) and asserts on what the user sees.
- `foo.property.test.ts` checks invariants across many inputs.

[.github/workflows/ci.yml](./.github/workflows/ci.yml) runs lint, test and build on every
push and PR to `main`. A change is done when all three pass.

## Privacy

[public/privacy.html](./public/privacy.html), linked from the sign-in screen, describes what
data is stored locally vs. in the cloud (only if you create an account) and how to delete it.

## Credits

The 3D figure is adapted from [Quaternius](https://quaternius.com/)'s CC0 "Universal Base
Characters" set.
