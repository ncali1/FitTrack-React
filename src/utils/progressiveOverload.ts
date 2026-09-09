/**
 * Suggests the next set's weight/reps/sets from an exercise's most recent completed
 * performance, using a simple, conservative progressive-overload heuristic: if the last
 * attempt felt easy, nudge the weight up a little; otherwise, repeat it. This never
 * suggests a heavier weight after a "hard" or unrated set — only "easy" earns an
 * increase, which keeps the suggestion safe to take at face value.
 */
import type { ExercisePerformance } from '@/types'

/** kg added when the last set was rated "easy" — a conservative, commonly-used increment. */
const EASY_INCREMENT_KG = 2.5

export interface PerformanceSuggestion {
  weight?: number
  actualReps: number
  actualSets: number
  /** Short, human-readable rationale shown alongside the suggestion. */
  note: string
}

/**
 * Builds a suggestion from an exercise's performance history, newest first (the shape
 * `getExerciseHistory` already returns). Returns `null` when there's no completed prior
 * performance to base a suggestion on.
 */
export function suggestNextPerformance(history: ExercisePerformance[]): PerformanceSuggestion | null {
  const last = history.find((p) => p.completed && !p.isWarmup)
  if (!last || last.actualReps == null || last.actualSets == null) return null

  if (last.difficultyLevel === 'easy' && typeof last.weight === 'number') {
    return {
      weight: last.weight + EASY_INCREMENT_KG,
      actualReps: last.actualReps,
      actualSets: last.actualSets,
      note: 'Last time felt easy — try a bit more weight.',
    }
  }

  return {
    weight: last.weight,
    actualReps: last.actualReps,
    actualSets: last.actualSets,
    note: 'Matching your last logged set.',
  }
}
