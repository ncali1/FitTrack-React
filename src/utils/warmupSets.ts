/**
 * Builds a ramp of warm-up sets leading up to a working weight, so you don't have to work
 * out the percentages and round them to loadable plates mid-workout. Uses a common,
 * conservative ramp (empty bar, then ~40/60/80% with falling reps) — enough to groove the
 * movement without tiring you out before the working sets.
 */
import type { WeightUnit } from './units'
import { standardBarWeight } from './plateCalculator'

const RAMP = [
  { pct: 0.4, reps: 5 },
  { pct: 0.6, reps: 3 },
  { pct: 0.8, reps: 2 },
]

/** Reps for the empty-bar opener — light enough to be a pure movement rehearsal. */
const EMPTY_BAR_REPS = 10

/** Smallest total jump a typical gym can load: a pair of the smallest common plates. */
const INCREMENT: Record<WeightUnit, number> = { kg: 2.5, lb: 5 }

const EPSILON = 1e-9

export interface WarmupSet {
  /** Weight in the same display unit as the working weight passed in. */
  weight: number
  reps: number
}

/**
 * @param workingWeight - The working-set weight, in `unit`.
 * @param unit - Display unit; picks the bar weight and the rounding increment.
 * @returns Warm-up sets, lightest first, every one strictly lighter than the working
 * weight. Starts with the empty bar when the working weight is above it; below that
 * (dumbbells, light machines) it's just the percentage ramp. Empty when the weight is too
 * light for a ramp to mean anything.
 */
export function generateWarmupSets(workingWeight: number, unit: WeightUnit): WarmupSet[] {
  if (!(workingWeight > 0)) return []

  const bar = standardBarWeight(unit)
  const increment = INCREMENT[unit]
  const sets: WarmupSet[] = workingWeight > bar ? [{ weight: bar, reps: EMPTY_BAR_REPS }] : []

  for (const { pct, reps } of RAMP) {
    // Rounded down, so a warm-up never ends up heavier than its percentage intends. The
    // epsilon stops float error landing an exact hit a hair under and dropping it a whole step.
    const weight = Math.floor((workingWeight * pct) / increment + EPSILON) * increment
    const previous = sets.at(-1)?.weight ?? 0
    if (weight > previous && weight < workingWeight) sets.push({ weight, reps })
  }

  return sets
}
