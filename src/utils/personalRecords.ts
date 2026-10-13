/**
 * Computes personal records (heaviest weight, most reps) from an exercise's
 * logged performance history, and detects whether a newly-submitted performance sets a
 * new record. Weight comparisons operate on canonical kg values — callers only need to
 * convert for display, never for the comparison itself.
 */
import type { ExercisePerformance, WorkoutSession } from '@/types'

export interface PersonalRecord {
  /** Heaviest weight (kg) ever logged for this exercise, or null if none logged. */
  maxWeight: number | null
  /** Reps performed at that heaviest-weight set, for context. */
  maxWeightReps: number | null
  /** Most reps ever logged in a single completed set entry, or null if none logged. */
  maxReps: number | null
  /** Weight (kg) used on that highest-reps set, for context. */
  maxRepsWeight: number | null
}

const EMPTY_RECORD: PersonalRecord = {
  maxWeight: null,
  maxWeightReps: null,
  maxReps: null,
  maxRepsWeight: null,
}

/**
 * Calculates the personal records for an exercise from its full performance history.
 * Only completed, non-warm-up entries are considered.
 */
export function calculatePersonalRecord(performances: ExercisePerformance[]): PersonalRecord {
  let record = { ...EMPTY_RECORD }

  for (const p of performances) {
    if (!p.completed || p.isWarmup) continue

    if (typeof p.weight === 'number') {
      if (record.maxWeight === null || p.weight > record.maxWeight) {
        record = { ...record, maxWeight: p.weight, maxWeightReps: p.actualReps ?? null }
      }
    }
    if (typeof p.actualReps === 'number') {
      if (record.maxReps === null || p.actualReps > record.maxReps) {
        record = { ...record, maxReps: p.actualReps, maxRepsWeight: p.weight ?? null }
      }
    }
  }

  return record
}

/**
 * Determines whether a candidate performance (about to be submitted) would set a new
 * weight and/or reps record, given the exercise's prior performance history. A warm-up
 * candidate never counts as a PR, regardless of the numbers.
 */
export function detectNewRecords(
  priorPerformances: ExercisePerformance[],
  candidate: { weight?: number; actualReps?: number; isWarmup?: boolean }
): { isWeightPR: boolean; isRepsPR: boolean } {
  if (candidate.isWarmup) return { isWeightPR: false, isRepsPR: false }

  const prior = calculatePersonalRecord(priorPerformances)

  const isWeightPR =
    typeof candidate.weight === 'number' && (prior.maxWeight === null || candidate.weight > prior.maxWeight)

  const isRepsPR =
    typeof candidate.actualReps === 'number' &&
    (prior.maxReps === null || candidate.actualReps > prior.maxReps)

  return { isWeightPR, isRepsPR }
}

/**
 * Counts how many times a personal record has been set across all sessions: each logged
 * performance that beat the exercise's best weight or best reps at that point. An
 * exercise's first logged performance sets the baseline and isn't counted.
 */
export function countPersonalRecords(sessions: WorkoutSession[]): number {
  const priorByExercise = new Map<string, ExercisePerformance[]>()
  let count = 0

  for (const session of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const performance of session.exercises) {
      if (!performance.completed || performance.isWarmup) continue

      const prior = priorByExercise.get(performance.exerciseId) ?? []
      if (prior.length > 0) {
        const { isWeightPR, isRepsPR } = detectNewRecords(prior, performance)
        if (isWeightPR || isRepsPR) count += 1
      }
      priorByExercise.set(performance.exerciseId, [...prior, performance])
    }
  }

  return count
}
