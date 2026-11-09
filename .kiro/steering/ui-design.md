---
inclusion: fileMatch
fileMatchPattern: ["src/components/**", "src/index.css", "src/App.tsx"]
---

# UI and design system

**"Training log"** — a paper gym logbook rendered dark. Warm near-black pages, chalk-white
ink, hairline rules instead of floating cards, condensed uppercase headings, monospace
numbers, near-square corners, no shadows or gradients. Every token and shared class is
defined in `src/index.css` — use them instead of raw colours or one-off styling.

## Colour carries meaning — keep it to two signals

- **Orange (`accent`)** — something you can act on: primary buttons, selected chips/days,
  the active tab, progress.
- **Chalk yellow (`mark`)** — done or worth celebrating: completed exercises, PRs, "synced".
- Everything else is neutral (`ink`, `ink-muted`, `ink-faint`, `surface-border`). Don't add
  per-category colours (muscle groups are deliberately monochrome — see `muscleGroupStyles.ts`).
  Red is only for errors and destructive actions.

## Tokens (Tailwind classes generated from `@theme`)

- Backgrounds: `bg-canvas` (page), `bg-canvas-700`/`-800`/`-900`/`-950`, `bg-surface`,
  `bg-surface-hover`, `border-surface-border`.
- Text: `text-ink` (primary), `text-ink-muted` (secondary), `text-ink-faint` (hints).
- Signals: `accent` / `accent-400…800`, `mark` / `mark-400…600`.
- Fonts: Archivo (variable width) via `font-sans`; JetBrains Mono via `font-mono`.
  `h1`–`h3` are condensed uppercase automatically (base layer, so utilities still override).
- Radius: `--radius` is 3px, so the whole `rounded-*` scale stays near-square. Avoid
  `rounded-full` except for genuinely circular things (spinners, the rest-timer ring).

No hex values or arbitrary colours (`text-[#…]`) in components. If a token is missing, add it
to `@theme`. Canvas/WebGL code reads tokens with `getComputedStyle` — charts go through
`src/components/progress/chartTheme.ts`.

## Shared component classes

- Type: `display` (condensed uppercase headline), `num` (mono tabular numbers — use for
  weights, reps, streaks, timers), `eyebrow` (small mono uppercase label: dates, section titles)
- Rules: `rule` (hairline), `rule-heavy` (2px ink). Prefer a ruled list
  (`border-y divide-y divide-surface-border`) over a stack of cards.
- Buttons: `btn-primary` (solid orange — one per view), `btn-secondary`, `btn-ghost`,
  `btn-danger`, `btn-icon`. All are uppercase and at least 44px tall.
- Chips: `chip` + `chip-on` for filters, presets and option pickers.
- Forms: `field-label`, `field-input` (numeric inputs render in mono automatically), `field-error`
- Containers: `card`, `card-pad`, `card-hover`, `stat-tile` (+ `-accent`, `-mark`), `section-header`
- Badges: `badge-accent`, `badge-mark`, `badge-muted`, `badge-warn`, `badge-danger` (square stamped tags)
- Overlays: `modal-overlay` + `modal-panel`; `alert-error` for inline errors
- Empty states: `empty-blob` around a lucide icon — no emoji
- Icons: `lucide-react`, typically `size={18} strokeWidth={2}`

## Patterns

- **Modals and sheets:** portal to `document.body` (so the top bar's backdrop doesn't clip them),
  call `useBodyScrollLock()` while open, close on a backdrop click and an `X` button with
  `aria-label="Close"`.
- **Toasts:** `sonner` (the `<Toaster>` is mounted in `main.tsx`), positioned below the top bar.
  Keep messages short; reserve them for confirming actions and surfacing errors.
- **Touch first:** tap targets at least 44×44 px, no hover-only affordances, numeric inputs use
  `inputMode="decimal"` / `"numeric"`.
- **Motion:** keep animations short and subtle — no bounce, overshoot or floating, and respect `prefers-reduced-motion`
  (already handled globally in `index.css` — don't override it).
- **Accessibility:** real `<button>`s for actions, `aria-pressed` on toggles, labels on every input,
  `aria-label` on icon-only buttons. Tests query by role and label, so this is also what keeps them working.
- **Units:** never display raw stored values. Weights go through the user's `weightUnit` and
  distances through `distanceUnit` (stored as km), using the helpers in `src/utils/units.ts`
  and `src/utils/cardio.ts`.
