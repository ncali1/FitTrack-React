---
inclusion: always
---

# Project structure

```
src/
  components/<feature>/   UI grouped by feature: cardio, checklist, library, profile,
                          progress, routine, settings, widgets, layout, ui, …
  stores/                 Zustand stores, one per domain (exercises, workoutSessions, cardio, settings, restTimer, …)
  services/               Side effects and platform access: database (Dexie), storage,
                          cloudSync, supabaseClient, restAlert
  hooks/                  Reusable React hooks (useKeepAwake, useBodyScrollLock, …)
  utils/                  Pure functions: calculations, units, cardio, personalRecords, exportData, …
  data/                   Static data, e.g. the built-in exercise catalog (workoutLibrary.ts)
  types/index.ts          Shared domain types
  tests/setup.ts          Global test setup
supabase/schema.sql       Cloud schema + row-level security (re-runnable)
ios/, android/            Capacitor native projects
public/                   Static assets, icons, privacy.html
```

## Where code goes

- **Pure logic** (math, formatting, unit conversion) → `src/utils/`, with a unit test beside it.
- **Anything that touches a platform API** (IndexedDB, audio, notifications, wake lock,
  haptics, network) → `src/services/` or a hook in `src/hooks/`, never inline in a component.
- **Shared state** → a store in `src/stores/`. Component-local UI state stays in the component.
- **Components** stay presentational where possible: read from stores, call store actions.
- Import with the `@/` alias across folders; relative imports only within the same folder.

## Before adding anything new, search first

Look for an existing service, hook, store field or setting that already does the job, and
extend it instead of adding a parallel one. Two branches once each built their own rest-over
alert, keep-awake hook and sound setting, and merging them took real work. In particular:

- Rest alerts (sound, haptic, notification) → `src/services/restAlert.ts`
- Keep screen awake → `src/hooks/useKeepAwake.ts`
- Overlay scroll locking → `src/hooks/useBodyScrollLock.ts`
- Preferences → `src/stores/settings.ts`, shown in `src/components/profile/PreferencesCard.tsx`
- Exercise history / suggestions → `src/utils/calculations.ts`, `src/utils/progressiveOverload.ts`

## Tests live next to the code

`foo.ts` → `foo.test.ts`; user-flow tests are `*.e2e.test.tsx`; property-based tests are
`*.property.test.ts`. See `testing.md`.
