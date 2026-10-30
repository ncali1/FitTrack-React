---
inclusion: always
---

# Tech stack and workflow

- **React 19 + TypeScript** (strict), built with **Vite**. Path alias `@/` → `src/`.
- **Tailwind CSS v4** with design tokens in `src/index.css` (see `ui-design.md`).
- **Zustand** for state, one store per domain in `src/stores/`.
- **Dexie** (IndexedDB) for workout data; Zustand `persist` (localStorage) for preferences.
- **Chart.js** for charts, **lucide-react** for icons, **sonner** for toasts.
- **Supabase** for optional auth and cloud sync.
- **Capacitor 8** for the native iOS/Android builds (`ios/`, `android/`, `capacitor.config.ts`).
- **vite-plugin-pwa** for the manifest and service worker.
- **Vitest + Testing Library** on happy-dom for tests; **oxlint** for linting.

Don't add a new dependency when an existing one or a few lines of code will do. If one is
genuinely needed, prefer small, maintained, tree-shakeable packages, and for anything native
use an official `@capacitor/*` plugin (or a `@capacitor-community/*` one) matching Capacitor 8.

## Commands

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # tsc -b type-check + production build
npm run test         # vitest, single run
npm run lint         # oxlint
npm run ios          # build, cap sync, launch on the iOS simulator
npm run ios:live     # native shell pointed at the dev server (live reload)
npx cap sync         # after adding/removing a Capacitor plugin or changing native config
```

## Definition of done

A change is finished only when all three pass — CI (`.github/workflows/ci.yml`) runs exactly these:

1. `npm run lint` — no errors (the existing `only-export-components` warnings are known).
2. `npm run test` — all tests pass, and new behaviour has tests.
3. `npm run build` — type-check and build succeed.

## Code style

- Match the surrounding code. Functions are small and named for what they do.
- Doc comments (`/** ... */`) explain **why** — a browser quirk, a platform limit, a design
  choice — not what the next line does. Exported functions, stores and components get one.
- No `any`. Model data in `src/types/index.ts`, and derive input types from it
  (`Omit<CardioSession, 'id' | 'createdAt' | 'updatedAt'>`) rather than redeclaring shapes.
- Errors: catch at the boundary, log with `console.error('Failed to …:', err)`, and degrade
  gracefully — a failed sound, haptic or sync must never break the workout flow.
