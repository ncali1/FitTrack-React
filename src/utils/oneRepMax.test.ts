import { describe, it, expect } from 'vitest'
import { estimateOneRepMax, bestEstimatedOneRepMax } from './oneRepMax'
import { createMockExercisePerformance } from '@/tests/factories'

describe('estimateOneRepMax', () => {
  it('returns the weight itself for a single rep', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100)
  })

  it('applies the Epley formula for multiple reps', () => {
    // 100 * (1 + 5/30) = 116.666...
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 1)
  })
})

describe('bestEstimatedOneRepMax', () => {
  it('returns null when there are no completed weighted sets', () => {
    expect(bestEstimatedOneRepMax([])).toBeNull()
    expect(bestEstimatedOneRepMax([createMockExercisePerformance({ completed: false })])).toBeNull()
  })

  it('ignores sets with no weight logged (bodyweight exercises)', () => {
    const performances = [createMockExercisePerformance({ weight: undefined, actualReps: 12 })]
    expect(bestEstimatedOneRepMax(performances)).toBeNull()
  })

  it('ignores warm-up sets, even a heavier one that would otherwise win', () => {
    const performances = [
      createMockExercisePerformance({ isWarmup: true, weight: 200, actualReps: 5 }),
      createMockExercisePerformance({ weight: 80, actualReps: 10 }),
    ]
    expect(bestEstimatedOneRepMax(performances)?.weightKg).toBe(80)
  })

  it('picks the set with the highest estimated 1RM, not the heaviest weight', () => {
    const performances = [
      // Estimated 1RM: 100 * (1 + 1/30) ≈ 103.3
      createMockExercisePerformance({ weight: 100, actualReps: 1 }),
      // Estimated 1RM: 80 * (1 + 10/30) ≈ 106.7 — higher, despite the lighter weight
      createMockExercisePerformance({ weight: 80, actualReps: 10 }),
    ]
    const best = bestEstimatedOneRepMax(performances)
    expect(best?.weightKg).toBe(80)
    expect(best?.reps).toBe(10)
    expect(best?.estimated).toBeCloseTo(106.67, 1)
  })
})
