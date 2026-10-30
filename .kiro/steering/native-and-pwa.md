---
inclusion: fileMatch
fileMatchPattern: ["src/services/**", "src/hooks/**", "capacitor.config.ts", "vite.config.ts", "ios/**", "android/**", "public/**"]
---

# Native (Capacitor) and PWA

The same web build runs in three places: a browser tab, an installed PWA, and the
Capacitor iOS/Android shell. Every platform feature needs to work, or fail quietly, in all three.

## Platform branching

- Branch with `Capacitor.isNativePlatform()`. Use the Capacitor plugin on native and the web
  API as the fallback; if neither exists, silently do nothing.
- Wrap plugin and web-API calls in `try/catch` (or `.catch(() => {})` for fire-and-forget).
  A denied permission or missing API must never throw into the UI.
- Keep platform code inside `src/services/` or `src/hooks/` so components stay platform-agnostic.
- Installed plugins: `@capacitor/haptics`, `@capacitor/local-notifications`,
  `@capacitor-community/keep-awake`. After adding or removing one, run `npx cap sync`.

## Browser and OS behaviours to design around

- **Background timers are throttled or suspended.** Compute remaining time from wall-clock
  timestamps and recheck on `visibilitychange`. To alert while backgrounded on native,
  schedule a local notification for the end time when the app is hidden and cancel it on return
  (see `src/services/restAlert.ts`).
- **Audio needs a user gesture.** Create or resume the `AudioContext` in the tap that starts
  something, not when the alert later fires.
- **Screen wake locks are dropped when the page is hidden.** Re-acquire on visibility. Use the
  reference-counted `useKeepAwake` hook rather than requesting locks directly.
- **Notifications on Android Chrome** must go through the service worker registration
  (`registration.showNotification`); `new Notification()` throws there.
- **Permissions:** ask the first time a feature actually needs one, never on launch, and work without it.
- **iOS safe areas:** use the `pwa-safe-top` / `pwa-safe-bottom` utilities for edge-to-edge UI.

## Builds and deploys

- GitHub Pages serves the app under `/<repo-name>/`, set via `BASE_PATH` in the deploy workflow.
  Never hard-code an absolute `/` path to an asset; use Vite's `import.meta.env.BASE_URL` or imports.
- `CAP_SERVER_URL` (set only by `npm run ios:live`) points the native shell at the dev server.
  It must never be set for a build that ships.
- App id is `com.ncali1.fittrack`. Icons come from `resources/icon.png` via `scripts/generate-icons.py`.
