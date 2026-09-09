import { describe, it, expect } from 'vitest'
import { suggestNextPerformance } from './progressiveOverload'
import { createMockExercisePerformance } from '@/tests/factories'

describe('suggestNextPerformance', () => {
  it('returns null when there is no completed history', () => {
    expect(suggestNextPerformance([])).toBeNull()
    expect(suggestNextPerformance([createMockExercisePerformance({ completed: false })])).toBeNull()
  })

  it('suggests a small weight increase after an "easy" set', () => {
    const history = [
      createMockExercisePerformance({ difficultyLevel: 'easy', weight: 60, actualSets: 3, actualReps: 8 }),
    ]
    const suggestion = suggestNextPerformance(history)

    expect(suggestion).toEqual({
      weight: 62.5,
      actualSets: 3,
      actualReps: 8,
      note: 'Last time felt easy — try a bit more weight.',
    })
  })

  it('suggests repeating the same weight and reps after a "moderate" set', () => {
    const history = [
      createMockExercisePerformance({ difficultyLevel: 'moderate', weight: 60, actualSets: 3, actualReps: 8 }),
    ]
    expect(suggestNextPerformance(history)).toEqual({
      weight: 60,
      actualSets: 3,
      actualReps: 8,
      note: 'Matching your last logged set.',
    })
  })

  it('does not increase weight after a "hard" set', () => {
    const history = [
      createMockExercisePerformance({ difficultyLevel: 'hard', weight: 60, actualSets: 3, actualReps: 8 }),
    ]
    expect(suggestNextPerformance(history)?.weight).toBe(60)
  })

  it('uses the most recent completed entry, skipping incomplete ones', () => {
    const history = [
      createMockExercisePerformance({ completed: false, weight: 999, actualSets: 1, actualReps: 1 }),
      createMockExercisePerformance({ difficultyLevel: 'moderate', weight: 60, actualSets: 3, actualReps: 8 }),
    ]
    expect(suggestNextPerformance(history)?.weight).toBe(60)
  })

  it('skips warm-up entries and bases the suggestion on the last working set', () => {
    const history = [
      createMockExercisePerformance({ isWarmup: true, weight: 20, actualSets: 2, actualReps: 10 }),
      createMockExercisePerformance({ difficultyLevel: 'moderate', weight: 60, actualSets: 3, actualReps: 8 }),
    ]
    expect(suggestNextPerformance(history)?.weight).toBe(60)
  })

  it('handles a bodyweight exercise (no weight logged) without suggesting a weight', () => {
    const history = [
      createMockExercisePerformance({ difficultyLevel: 'easy', weight: undefined, actualSets: 3, actualReps: 12 }),
    ]
    const suggestion = suggestNextPerformance(history)
    expect(suggestion?.weight).toBeUndefined()
    expect(suggestion?.actualReps).toBe(12)
  })
})
