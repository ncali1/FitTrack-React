# UI and Design System

The look is a **training log**: a paper gym logbook rendered dark. Warm near-black pages, chalk-white ink, hairline rules instead of floating cards, condensed uppercase headings, monospace numbers, near-square corners, no shadows or gradients.

Every token and shared class is defined in `src/index.css`. Use them instead of raw colours or one-off styling. The full guidance is `.kiro/steering/ui-design.md`; this page is a summary.

## Colour carries meaning

Two signals only.

| Colour | Token | Means |
| --- | --- | --- |
| Orange | `accent` | Something you can act on: primary buttons, selected chips and days, the active tab, progress |
| Chalk yellow | `mark` | Done or worth celebrating: completed exercises, PRs, "synced" |
| Neutral | `ink`, `ink-muted`, `ink-faint`, `surface-border` | Everything else |
| Red | | Errors and destructive actions only |

Do not add per-category colours. Muscle groups are deliberately monochrome (`src/utils/muscleGroupStyles.ts`).

## Tokens

| Group | Classes |
| --- | --- |
| Backgrounds | `bg-canvas`, `bg-canvas-700` to `-950`, `bg-surface`, `bg-surface-hover`, `border-surface-border` |
| Text | `text-ink`, `text-ink-muted`, `text-ink-faint` |
| Signals | `accent`, `accent-400` to `800`, `mark`, `mark-400` to `600` |
| Fonts | `font-sans` (Archivo), `font-mono` (JetBrains Mono) |
| Radius | `--radius` is 3px, so the `rounded-*` scale stays near-square |

No hex values or arbitrary colours such as `text-[#…]` in components. If a token is missing, add it to `@theme` in `src/index.css`. Charts read tokens through `src/components/progress/chartTheme.ts`.

## Shared classes

| Purpose | Classes |
| --- | --- |
| Type | `display`, `num` (mono tabular numbers for weights, reps, timers), `eyebrow` |
| Rules | `rule`, `rule-heavy` |
| Buttons | `btn-primary` (one per view), `btn-secondary`, `btn-ghost`, `btn-danger`, `btn-icon` |
| Chips | `chip`, `chip-on` |
| Forms | `field-label`, `field-input`, `field-error` |
| Containers | `card`, `card-pad`, `card-hover`, `stat-tile`, `section-header` |
| Badges | `badge-accent`, `badge-mark`, `badge-muted`, `badge-warn`, `badge-danger` |
| Overlays | `modal-overlay`, `modal-panel`, `alert-error` |
| Empty states | `empty-blob` around a lucide icon. No emoji. |

Prefer a ruled list (`border-y divide-y divide-surface-border`) over a stack of cards.

## Patterns

| Pattern | Rule |
| --- | --- |
| Modals and sheets | Portal to `document.body`, call `useBodyScrollLock()` while open, close on a backdrop click and on an `X` button with `aria-label="Close"` |
| Toasts | `sonner`. The `<Toaster>` is mounted in `src/main.tsx`, offset below the top bar. Keep messages short. |
| Touch first | Tap targets at least 44×44 px, no hover-only affordances, numeric inputs use `inputMode="decimal"` or `"numeric"` |
| Motion | Short and subtle. `prefers-reduced-motion` is handled globally in `src/index.css`; do not override it. |
| Accessibility | Real `<button>`s, `aria-pressed` on toggles, a label on every input, `aria-label` on icon-only buttons |
| Units | Never display a raw stored value. Go through `src/utils/units.ts` and `src/utils/cardio.ts`. |
| Icons | `lucide-react`, typically `size={18} strokeWidth={2}` |

Accessibility doubles as test support: the tests query by role and label, so accessible markup is also what keeps them working. See [Testing](Testing.md).

## Layout

`src/components/layout/Layout.tsx` wraps every tab with `TopBar` and, on small screens, `BottomNav`. Both read the tab list from `src/components/layout/tabs.ts` and the active tab from `useUIStore`, so they stay in sync.
