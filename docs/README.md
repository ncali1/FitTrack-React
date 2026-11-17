# FitTrack

FitTrack is a gym logbook for a phone. It is a mobile-first fitness tracker for one person training on their own device. It ships as an installable PWA on GitHub Pages and as native iOS and Android apps built with Capacitor.

- Live app: <https://ncali1.github.io/FitTrack-React/>
- Repository: <https://github.com/ncali1/FitTrack-React>

This wiki is a first draft, kept in the repo so it is reviewed and versioned with the code. Every statement was taken from the code or the project's own docs at commit `dc35708`. Lines marked **TODO: confirm** are things the repository does not answer.

## Principles

These come from `.kiro/steering/product.md` and override convenience when the two conflict.

| Principle | What it means in practice |
| --- | --- |
| Offline-first, local-first | All data lives on the device in IndexedDB. Every feature works with no network and no account. The UI never waits on a network request. |
| Cloud sync is optional | Supabase sign-in and sync exist only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set at build time. With them unset the app behaves the same, without sign-in or cross-device sync. |
| Phone first | Designed for one-handed use mid-workout: large tap targets, little typing, sensible defaults, nothing that needs hover. Desktop is secondary. |
| Respect the user's data | No analytics or third-party tracking. Destructive actions ask for confirmation. Backup export and import cover every kind of workout record (exercises, routines, programs, workouts, cardio, body weight). Per-device preferences and an in-progress guided workout are not included. |

## Tech stack

| Layer | Tools |
| --- | --- |
| App | React 19, TypeScript (strict), Vite |
| Styling | Tailwind CSS v4 with design tokens in `src/index.css`, Archivo and JetBrains Mono fonts |
| State and storage | Zustand, Dexie (IndexedDB) for workout data, localStorage for per-device preferences |
| Visuals | Chart.js, three.js, lucide-react, sonner |
| Native and PWA | Capacitor 8, vite-plugin-pwa |
| Cloud (optional) | Supabase auth and Postgres with row-level security |
| Quality | Vitest, Testing Library, happy-dom, oxlint, GitHub Actions |

Sources: `package.json`, `.kiro/steering/tech.md`, `README.md`.

## Map of the wiki

| Page | Read it when you want to |
| --- | --- |
| [User Guide](User-Guide.md) | Learn what each screen does and how the main flows work |
| [Getting Started](Getting-Started.md) | Install, run, test and build the app on your machine |
| [Architecture](Architecture.md) | Find where code lives and how a tap becomes a saved record |
| [Data Model and Storage](Data-Model-and-Storage.md) | Look up types, IndexedDB tables, localStorage keys and the backup format |
| [Cloud Sync and Auth](Cloud-Sync-and-Auth.md) | Understand the optional Supabase sync and sign-in |
| [Native and PWA](Native-and-PWA.md) | Work on Capacitor, the service worker, or platform quirks |
| [UI and Design System](UI-and-Design-System.md) | Build or restyle a component |
| [Testing](Testing.md) | Write or run tests |
| [CI, Security and Release](CI-Security-and-Release.md) | See what runs on a push, how deploys happen, and which security gates exist |
| [Privacy and Data](Privacy-and-Data.md) | Check what is stored where and how it is deleted |

## One naming trap to know first

The UI and the code use different words for the same things. This catches everyone once.

| What the user sees | What the code calls it |
| --- | --- |
| Routine (for example "Push Day") | `WorkoutTemplate`, the `workoutTemplates` table and store |
| Program, or weekly plan | `Routine`, the `routine` table. `isActive` marks the current one |
| Workout, or session | `WorkoutSession`, one per date |

The reason is in `src/types/index.ts`: `Routine` was already the name of the weekly plan and is baked into persisted table names, so the newer reusable exercise list had to take a different name. See [Data Model and Storage](Data-Model-and-Storage.md).

## Where the project's own guidance lives

`.kiro/steering/*.md` holds the working conventions (product, tech, structure, state and storage, native and PWA, UI design, testing, Supabase, git workflow). `CLAUDE.md` imports the same files. This wiki summarises them and adds what the code shows. When the two disagree, the code wins.
