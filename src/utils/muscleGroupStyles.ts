/**
 * Maps each muscle group to its own color so exercise tags read at a glance instead of
 * blurring into one uniform badge color. Classes are written out in full (not built via
 * string interpolation) because Tailwind's compiler only picks up class names it can see
 * literally in source.
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

const NEUTRAL: MuscleGroupStyle = {
  pill: 'bg-canvas-800 border-surface-border text-ink-muted',
  badge: 'bg-surface-hover text-ink-muted',
  text: 'text-ink-muted',
  bar: 'bg-ink-faint',
}

const MUSCLE_GROUP_STYLES: Record<string, MuscleGroupStyle> = {
  Chest: {
    pill: 'bg-accent-500/15 border-accent-500 text-accent-400',
    badge: 'bg-accent-500/15 text-accent-400',
    text: 'text-accent-400',
    bar: 'bg-accent-500',
  },
  Back: {
    pill: 'bg-cyan-500/15 border-cyan-500 text-cyan-400',
    badge: 'bg-cyan-500/15 text-cyan-400',
    text: 'text-cyan-400',
    bar: 'bg-cyan-500',
  },
  Shoulders: {
    pill: 'bg-violet-500/15 border-violet-500 text-violet-400',
    badge: 'bg-violet-500/15 text-violet-400',
    text: 'text-violet-400',
    bar: 'bg-violet-500',
  },
  Biceps: {
    pill: 'bg-pink-500/15 border-pink-500 text-pink-400',
    badge: 'bg-pink-500/15 text-pink-400',
    text: 'text-pink-400',
    bar: 'bg-pink-500',
  },
  Triceps: {
    pill: 'bg-fuchsia-500/15 border-fuchsia-500 text-fuchsia-400',
    badge: 'bg-fuchsia-500/15 text-fuchsia-400',
    text: 'text-fuchsia-400',
    bar: 'bg-fuchsia-500',
  },
  Forearms: {
    pill: 'bg-sky-500/15 border-sky-500 text-sky-400',
    badge: 'bg-sky-500/15 text-sky-400',
    text: 'text-sky-400',
    bar: 'bg-sky-500',
  },
  Legs: {
    pill: 'bg-lime-500/15 border-lime-500 text-lime-500',
    badge: 'bg-lime-500/15 text-lime-500',
    text: 'text-lime-500',
    bar: 'bg-lime-500',
  },
  Quadriceps: {
    pill: 'bg-emerald-500/15 border-emerald-500 text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-400',
    text: 'text-emerald-400',
    bar: 'bg-emerald-500',
  },
  Hamstrings: {
    pill: 'bg-teal-500/15 border-teal-500 text-teal-400',
    badge: 'bg-teal-500/15 text-teal-400',
    text: 'text-teal-400',
    bar: 'bg-teal-500',
  },
  Calves: {
    pill: 'bg-blue-500/15 border-blue-500 text-blue-400',
    badge: 'bg-blue-500/15 text-blue-400',
    text: 'text-blue-400',
    bar: 'bg-blue-500',
  },
  Glutes: {
    pill: 'bg-rose-500/15 border-rose-500 text-rose-400',
    badge: 'bg-rose-500/15 text-rose-400',
    text: 'text-rose-400',
    bar: 'bg-rose-500',
  },
  Core: {
    pill: 'bg-amber-500/15 border-amber-500 text-amber-400',
    badge: 'bg-amber-500/15 text-amber-400',
    text: 'text-amber-400',
    bar: 'bg-amber-500',
  },
}

export function muscleGroupStyle(group: string): MuscleGroupStyle {
  return MUSCLE_GROUP_STYLES[group] ?? NEUTRAL
}
