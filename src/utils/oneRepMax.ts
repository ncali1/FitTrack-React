/**
 * Estimated one-rep max, via the Epley formula — simple, widely used, and accurate
 * enough for tracking trends rather than programming max-effort attempts.
 */
import type { ExercisePerformance } from '@/types'

/** Estimates 1RM (in the same unit as `weightKg`) from a single set's weight and reps. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export interface BestOneRepMax {
  estimated: number
  /** The logged set (weight + reps) the estimate was derived from. */
  weightKg: number
  reps: number
}

/**
 * Finds the completed set with the highest *estimated* 1RM across an exercise's
 * performance history — not necessarily the heaviest single weight, since a lighter set
 * for more reps can imply a higher max. Ignores sets with no weight logged (bodyweight
 * exercises have no meaningful 1RM here) or no reps.
 */
export function bestEstimatedOneRepMax(performances: ExercisePerformance[]): BestOneRepMax | null {
  let best: BestOneRepMax | null = null

  for (const p of performances) {
    if (!p.completed || typeof p.weight !== 'number' || typeof p.actualReps !== 'number') continue
    const estimated = estimateOneRepMax(p.weight, p.actualReps)
    if (best === null || estimated > best.estimated) {
      best = { estimated, weightKg: p.weight, reps: p.actualReps }
    }
  }

  return best
}
