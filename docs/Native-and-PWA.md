# Native and PWA

The same web build runs in three places: a browser tab, an installed PWA, and the Capacitor iOS and Android shell. Every platform feature has to work, or fail quietly, in all three (`.kiro/steering/native-and-pwa.md`).

## Capacitor

`capacitor.config.ts`:

| Setting | Value |
| --- | --- |
| `appId` | `com.ncali1.fittrack` |
| `appName` | `FitTrack` |
| `webDir` | `dist` |
| `server.url` | Only when `CAP_SERVER_URL` is set, which only `npm run ios:live` does |

The native projects in `ios/` and `android/` are committed.

### Plugins

From `package.json`:

| Plugin | Used for | Used in |
| --- | --- | --- |
| `@capacitor/haptics` | Vibration when rest ends | `src/services/restAlert.ts` |
| `@capacitor/local-notifications` | "Rest over" notification while backgrounded | `src/services/restAlert.ts` |
| `@capacitor-community/keep-awake` | Keeping the screen on mid-workout | `src/hooks/useKeepAwake.ts` |

For anything native, use an official `@capacitor/*` plugin or a `@capacitor-community/*` one that matches Capacitor 8 (`.kiro/steering/tech.md`). After adding or removing one, run `npx cap sync` and commit the native-project changes in the same PR.

### Platform branching rules

- Branch with `Capacitor.isNativePlatform()`. Use the plugin on native and the web API as the fallback. If neither exists, do nothing.
- Wrap plugin and web-API calls in `try/catch`, or `.catch(() => {})` for fire-and-forget calls. A denied permission or missing API must never throw into the UI.
- Keep platform code in `src/services/` or `src/hooks/`, so components stay platform-agnostic.

### Icons

Every app icon (web, iOS, Android) is generated from `resources/icon.png` by `scripts/generate-icons.py`. The source must be square, at least 1024×1024, with no transparency, because iOS rejects icons with an alpha channel. The script needs Pillow.

## PWA

Configured with `vite-plugin-pwa` in `vite.config.ts`.

### Manifest

| Field | Value |
| --- | --- |
| `name` | FitTrack — Workout Tracker |
| `short_name` | FitTrack |
| `display` | `standalone` |
| `orientation` | `portrait` |
| `theme_color`, `background_color` | `#0e0e0d` |
| `start_url`, `scope` | The build's base path |
| Icons | 72 to 512 px, plus maskable 192 and 512, from `public/icons/` |

Icon paths are relative to the manifest URL, so they resolve under any base path.

### Service worker

| Setting | Value | Why |
| --- | --- | --- |
| `registerType` | `autoUpdate` | A new version replaces the old one without asking |
| `globPatterns` | js, css, html, ico, png, svg, woff, woff2, glb | Precaches the whole app shell so the app is fully usable offline. `glb` is the 3D figure model. |
| `cleanupOutdatedCaches` | `true` | |
| `devOptions.enabled` | `false` | No service worker in `npm run dev` |

There is no runtime caching of data, because all real data is already in IndexedDB. Fonts are bundled from `@fontsource-variable` packages (imported in `src/index.css`), not loaded from a CDN, so they are precached too.

### Base path

GitHub Pages serves the app under `/<repo-name>/`. The deploy workflow sets `BASE_PATH` for that, and `vite.config.ts` falls back to `/` everywhere else (dev, Capacitor, a host at a domain root).

Never hard-code an absolute `/` path to an asset in app code. Use `import.meta.env.BASE_URL` or an import. The privacy policy link is an example: `` `${import.meta.env.BASE_URL}privacy.html` ``.

### Install banner

`src/components/widgets/InstallPrompt.tsx` captures Chrome's `beforeinstallprompt` event and shows its own banner. iOS Safari has no such event, so there it shows "Share → Add to Home Screen" instructions. See the [User Guide](User-Guide.md#installing-the-app).

## Platform quirks the code works around

| Quirk | What the code does | Where |
| --- | --- | --- |
| Background timers are throttled or suspended | Remaining time is computed from a wall-clock end timestamp and rechecked on `visibilitychange`, never decremented per tick | `src/stores/restTimer.ts`, `src/components/checklist/GuidedSession.tsx` |
| A backgrounded app cannot fire an alert from JS | On native, a local notification is scheduled with the OS for the rest's end time when the app is hidden, and cancelled when it returns | `src/services/restAlert.ts` |
| Audio needs a user gesture | The `AudioContext` is created or resumed when a rest starts (close to a tap), not when the alert fires | `primeAudio()` in `restAlert.ts` |
| A rest that "ends" long after its real end time is not news | The beep and haptic are skipped if the countdown finishes more than 3 seconds late, for example after the app was suspended | `STALE_AFTER_MS` in `restAlert.ts` |
| Screen wake locks are dropped when the page is hidden | The lock is re-acquired on `visibilitychange`. The hook is reference-counted so several components can hold it at once. | `src/hooks/useKeepAwake.ts` |
| Chrome on Android rejects `new Notification()` | Rest notifications go through the service worker registration (`registration.showNotification`) when one exists | `showWebNotification()` in `restAlert.ts` |
| Permission prompts on launch are unwelcome | Native apps ask for notification permission the first time a rest starts. The web app never asks from a rest: it shows rest notifications only if permission was already granted (for example through workout reminders). Storage persistence is asked after the first save. | `restAlert.ts`, `src/services/persistentStorage.ts` |
| iOS safe areas (notch, home indicator) | `pwa-safe-top` and `pwa-safe-bottom` utility classes add `env(safe-area-inset-*)` padding | `src/index.css` |
| A page behind a sheet still scrolls, and on iOS can steal swipes | A counted scroll lock on `<html>` | `src/hooks/useBodyScrollLock.ts` |
| A phone will kill a backgrounded app mid-workout | The guided session's position is persisted to localStorage | `src/stores/guidedSession.ts` |
| Safari clears unused site data after a few weeks unless installed | The app asks for persistent storage and shows the result in Profile | `src/services/persistentStorage.ts` |
| Some devices cannot draw WebGL | One cached capability check. The 3D preview falls back to a 2D diagram. | `src/services/webgl.ts` |
| `npx cap run ios` looks for a Simulator.app that Xcode 27 no longer ships | The iOS script installs and launches with `xcrun simctl` directly | `scripts/run-ios.sh` |

## Where each alert channel fires

From `src/services/restAlert.ts`:

| App state | Native app | Browser or PWA |
| --- | --- | --- |
| Foreground | Beep (if enabled) and Haptics plugin (if enabled) | Beep (if enabled) and `navigator.vibrate` (if enabled and supported) |
| Background or locked | OS-scheduled local notification | Best-effort notification, only if permission was already granted |

Only one rest is tracked at a time. The latest `armRestAlert()` wins.

## Live reload on a simulator

`npm run ios:live` sets `CAP_SERVER_URL=http://localhost:5173`, which makes the native shell load the Vite dev server (with `cleartext: true`). It must never be set for a build that ships.

Stopping the command is not enough to undo it. `npx cap sync ios` has already written the localhost URL into `ios/App/App/capacitor.config.json` (a generated, git-ignored file), and an Xcode archive bundles whatever that file holds. An app archived in that state tries to load localhost instead of its bundled UI. Before archiving, run `npm run ios`, or `npm run build` then `npx cap sync ios`, with `CAP_SERVER_URL` unset.

## TODO

- TODO: confirm how the native apps are signed and distributed (TestFlight, App Store, Play Store). The repo has build and simulator steps but no release process for native.
- TODO: confirm notification permission declarations on Android. `android/app/src/main/AndroidManifest.xml` declares only `INTERNET`; any others would come from the plugins' own manifests.
- TODO: confirm how an installed PWA user is told a new version is active. The service worker is set to `autoUpdate`, and no in-app update notice was found.
