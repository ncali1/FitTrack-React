# Getting Started

How to run FitTrack on your own machine.

## Prerequisites

| Need | For | Notes |
| --- | --- | --- |
| Node.js and npm | Everything | CI uses Node 24 (`.github/workflows/ci.yml`). TODO: confirm the minimum supported version; `package.json` has no `engines` field. |
| Xcode and CocoaPods | iOS simulator | macOS only. `scripts/run-ios.sh` is a bash script that calls `xcrun` and `xcodebuild`. |
| Android Studio | Android | |
| A Supabase project | Cloud sync | Optional. The app runs fully local without one. |

## Install and run

```bash
npm install
npm run dev
```

The dev server is at <http://localhost:5173>. No `.env` file is needed.

## npm scripts

From `package.json`:

| Script | What it runs | Use it to |
| --- | --- | --- |
| `npm run dev` | `vite` | Start the dev server |
| `npm run build` | `tsc -b && vite build` | Type-check, then build to `dist/` |
| `npm run preview` | `vite preview` | Serve the production build locally |
| `npm run lint` | `oxlint` | Lint |
| `npm run test` | `vitest --run` | Run the tests once |
| `npm run test:watch` | `vitest` | Run tests in watch mode |
| `npm run test:ui` | `vitest --ui` | Open the Vitest UI |
| `npm run test:coverage` | `vitest --run --coverage` | Coverage report. TODO: confirm this works; `vitest.config.ts` sets the `v8` provider but `@vitest/coverage-v8` is not in `package.json`. |
| `npm run ios` | `scripts/run-ios.sh` | Build, sync and launch on the iOS simulator |
| `npm run ios:live` | `scripts/run-ios.sh live` | Same, but the app loads from the dev server |

## Definition of done

A change is finished when these three pass. CI runs exactly these (`.kiro/steering/tech.md`, `.github/workflows/ci.yml`):

1. `npm run lint`: no errors. The existing `only-export-components` warnings are known.
2. `npm run test`: all tests pass, and new behaviour has tests.
3. `npm run build`: type-check and build succeed.

## Environment variables

| Variable | Read by | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `src/services/supabaseClient.ts` | Supabase project URL. Optional. |
| `VITE_SUPABASE_ANON_KEY` | `src/services/supabaseClient.ts` | Supabase public anon key. Optional. |
| `BASE_PATH` | `vite.config.ts` | Base path for the build. Defaults to `/`. Only the Pages deploy sets it. |
| `CAP_SERVER_URL` | `capacitor.config.ts` | Points the native shell at the dev server. Only `npm run ios:live` sets it. Never set it for a build that ships. |

`.env.example` lists the two Supabase names with empty values. `.env` and `.env.local` are in `.gitignore`.

Because the two Supabase variables start with `VITE_`, Vite embeds them in the client bundle. That is fine for the anon key, which is meant to be public and is protected by row-level security. It is the reason a service-role key must never go in this repo or its environment files.

## Enabling cloud sync (optional)

1. Copy the example file: `cp .env.example .env.local`
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project (Settings → API).
3. Run `supabase/schema.sql` in the Supabase SQL Editor. It creates the tables and their row-level security policies.
4. Restart the dev server.

The schema file is safe to re-run. Re-run it after pulling a change that touches it. See [Cloud Sync and Auth](Cloud-Sync-and-Auth.md) for what happens if you do not.

Leave both variables unset and the app behaves the same, without sign-in or sync.

## Running on iOS

```bash
npm run ios        # build, cap sync, install and launch on the simulator
npm run ios:live   # same, but served from the Vite dev server for live reload
```

What `scripts/run-ios.sh` does:

- Uses the booted simulator, or boots the first available iPhone.
- Runs `npm run build` and `npx cap sync ios`, then builds with `xcodebuild` and installs with `xcrun simctl`.
- It does not use `npx cap run ios`. The script's comment explains why: that command looks for a Simulator.app that Xcode 27 no longer ships.

`ios:live` points the app at `http://localhost:5173`. It keeps separate data from the bundled build and only works while the command is running. Run `npm run ios` afterwards to put a normal build back.

## Running on Android

```bash
npm run build
npx cap sync android
npx cap open android   # then run it from Android Studio
```

There is no npm script for Android.

## After changing native config

Run `npx cap sync` after adding or removing a Capacitor plugin or changing native config. `ios/` and `android/` are committed, so commit the resulting native-project changes in the same PR (`.kiro/steering/git-workflow.md`).

## Path alias

`@/` maps to `src/` in both `vite.config.ts` and `vitest.config.ts`. Use it for imports across folders, and relative imports only within the same folder (`.kiro/steering/structure.md`).

## Next

- [Architecture](Architecture.md) for where code goes.
- [Testing](Testing.md) before writing a test.
- [CI, Security and Release](CI-Security-and-Release.md) before opening a PR.
