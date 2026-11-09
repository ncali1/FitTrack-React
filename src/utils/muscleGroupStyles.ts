/**
 * Styling for muscle-group tags, pickers and balance bars. Deliberately one neutral style
 * for every group: in the "training log" design the group's name is the label, and a
 * rainbow of per-group colours competed with the only two colours that carry meaning
 * (orange = act on this, yellow = done/PR). Kept as a function so call sites don't need to
 * change if a group ever needs to stand out again.
 */
export interface MuscleGroupStyle {
  /** Selected/filled pill state — used in ExerciseForm's picker. */
  pill: string
  /** Static badge state — used on ExerciseCard. */
  badge: string
  /** Bare text/icon color, e.g. for a small dot indicator. */
  text: string
  /** Solid background fill, e.g. for a progress-bar segment (the badge tint is too faint at full opacity). */
  bar: string
}

const STYLE: MuscleGroupStyle = {
  pill: 'bg-accent-500 border-accent-500 text-canvas-950',
  badge: 'border-surface-border text-ink-muted',
  text: 'text-ink-muted',
  bar: 'bg-accent-500',
}

/** Returns the tag style for a muscle group (currently the same for every group). */
export function muscleGroupStyle(_group: string): MuscleGroupStyle {
  return STYLE
}
