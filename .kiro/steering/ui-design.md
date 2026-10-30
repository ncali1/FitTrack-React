---
inclusion: fileMatch
fileMatchPattern: ["src/components/**", "src/index.css", "src/App.tsx"]
---

# UI and design system

Dark UI with a teal accent and outlined buttons. Every token and shared class is defined in
`src/index.css` — use them instead of raw colours or one-off styling.

## Tokens (Tailwind classes generated from `@theme`)

- Backgrounds: `bg-canvas` (page), `bg-canvas-800`/`-900`/`-950`, `bg-surface`, `bg-surface-hover`,
  `border-surface-border`.
- Text: `text-ink` (primary), `text-ink-muted` (secondary), `text-ink-faint` (hints).
- Accent: `accent` / `accent-400…800` (teal, primary actions and highlights);
  `lime` for celebratory highlights such as PRs.
- Shadows: `shadow-card`, `shadow-glow`. Font: Inter via `font-sans` / `font-heading`.

No hex values or arbitrary colours (`text-[#…]`) in components. If a token is missing, add it to `@theme`.

## Shared component classes

- Buttons: `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `btn-icon`
- Forms: `field-label`, `field-input`, `field-error`
- Containers: `card`, `card-pad`, `card-hover`, `stat-tile` (+ `-accent`, `-lime`, `-violet`), `section-header`
- Badges: `badge-accent`, `badge-lime`, `badge-muted`, `badge-warn`, `badge-danger`, …
- Overlays: `modal-overlay` + `modal-panel`; `alert-error` for inline errors
- Icons: `lucide-react`, typically `size={18} strokeWidth={2}`

## Patterns

- **Modals and sheets:** portal to `document.body` (so the top bar's backdrop doesn't clip them),
  call `useBodyScrollLock()` while open, close on a backdrop click and an `X` button with
  `aria-label="Close"`.
- **Toasts:** `sonner` (the `<Toaster>` is mounted in `main.tsx`), positioned below the top bar.
  Keep messages short; reserve them for confirming actions and surfacing errors.
- **Touch first:** tap targets at least 44×44 px, no hover-only affordances, numeric inputs use
  `inputMode="decimal"` / `"numeric"`.
- **Motion:** keep animations short and subtle, and respect `prefers-reduced-motion`
  (already handled globally in `index.css` — don't override it).
- **Accessibility:** real `<button>`s for actions, `aria-pressed` on toggles, labels on every input,
  `aria-label` on icon-only buttons. Tests query by role and label, so this is also what keeps them working.
- **Units:** never display raw stored values. Weights go through the user's `weightUnit` and
  distances through `distanceUnit` (stored as km), using the helpers in `src/utils/units.ts`
  and `src/utils/cardio.ts`.
