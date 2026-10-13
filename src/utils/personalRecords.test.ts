import { describe, it, expect } from 'vitest'
import { calculatePersonalRecord, detectNewRecords, countPersonalRecords } from './personalRecords'
import { createMockExercisePerformance, createMockWorkoutSession } from '@/tests/factories'

describe('calculatePersonalRecord', () => {
  it('returns all-null when there is no history', () => {
    const record = calculatePersonalRecord([])
    expect(record).toEqual({ maxWeight: null, maxWeightReps: null, maxReps: null, maxRepsWeight: null })
  })

  it('ignores incomplete entries', () => {
    const record = calculatePersonalRecord([
      createMockExercisePerformance({ completed: false, weight: 999, actualReps: 999 }),
    ])
    expect(record.maxWeight).toBeNull()
    expect(record.maxReps).toBeNull()
  })

  it('finds the heaviest weight and the reps performed at it', () => {
    const record = calculatePersonalRecord([
      createMockExercisePerformance({ weight: 50, actualReps: 8 }),
      createMockExercisePerformance({ weight: 60, actualReps: 5 }),
      createMockExercisePerformance({ weight: 40, actualReps: 10 }),
    ])
    expect(record.maxWeight).toBe(60)
    expect(record.maxWeightReps).toBe(5)
  })

  it('finds the highest reps and the weight used at that set, independently of maxWeight', () => {
    const record = calculatePersonalRecord([
      createMockExercisePerformance({ weight: 50, actualReps: 8 }),
      createMockExercisePerformance({ weight: 20, actualReps: 15 }),
    ])
    expect(record.maxReps).toBe(15)
    expect(record.maxRepsWeight).toBe(20)
  })

  it('ignores warm-up sets, even ones that would otherwise be the record', () => {
    const record = calculatePersonalRecord([
      createMockExercisePerformance({ weight: 999, actualReps: 999, isWarmup: true }),
      createMockExercisePerformance({ weight: 50, actualReps: 8 }),
    ])
    expect(record.maxWeight).toBe(50)
    expect(record.maxReps).toBe(8)
  })
})

describe('detectNewRecords', () => {
  it('flags both a weight and reps PR on the very first logged performance', () => {
    const flags = detectNewRecords([], { weight: 50, actualReps: 10 })
    expect(flags).toEqual({ isWeightPR: true, isRepsPR: true })
  })

  it('flags a weight PR only when strictly exceeding the prior max', () => {
    const prior = [createMockExercisePerformance({ weight: 50, actualReps: 8 })]
    expect(detectNewRecords(prior, { weight: 55, actualReps: 8 }).isWeightPR).toBe(true)
    expect(detectNewRecords(prior, { weight: 50, actualReps: 8 }).isWeightPR).toBe(false)
    expect(detectNewRecords(prior, { weight: 45, actualReps: 8 }).isWeightPR).toBe(false)
  })

  it('flags a reps PR only when strictly exceeding the prior max', () => {
    const prior = [createMockExercisePerformance({ weight: 50, actualReps: 8 })]
    expect(detectNewRecords(prior, { weight: 50, actualReps: 9 }).isRepsPR).toBe(true)
    expect(detectNewRecords(prior, { weight: 50, actualReps: 8 }).isRepsPR).toBe(false)
  })

  it('does not flag a PR when the candidate omits weight/reps entirely', () => {
    const prior = [createMockExercisePerformance({ weight: 50, actualReps: 8 })]
    expect(detectNewRecords(prior, {})).toEqual({ isWeightPR: false, isRepsPR: false })
  })

  it('never flags a PR for a warm-up candidate, regardless of the numbers', () => {
    const prior = [createMockExercisePerformance({ weight: 50, actualReps: 8 })]
    expect(detectNewRecords(prior, { weight: 999, actualReps: 999, isWarmup: true })).toEqual({
      isWeightPR: false,
      isRepsPR: false,
    })
  })
})

describe('countPersonalRecords', () => {
  const log = (date: string, weight: number, actualReps: number, extra = {}) =>
    createMockWorkoutSession({
      date,
      exercises: [createMockExercisePerformance({ exerciseId: 'bench', weight, actualReps, ...extra })],
    })

  it('returns 0 with no sessions, and does not count an exercise\'s first log', () => {
    expect(countPersonalRecords([])).toBe(0)
    expect(countPersonalRecords([log('2025-01-01', 50, 8)])).toBe(0)
  })

  it('counts each later session that beats the best weight or the best reps so far', () => {
    const sessions = [
      log('2025-01-01', 50, 8),
      log('2025-01-03', 55, 8), // weight record
      log('2025-01-05', 55, 8), // matches, not a record
      log('2025-01-07', 50, 10), // reps record
      log('2025-01-09', 45, 6), // neither
    ]
    expect(countPersonalRecords(sessions)).toBe(2)
  })

  it('walks sessions in date order regardless of the order they are stored in', () => {
    const sessions = [log('2025-01-05', 50, 8), log('2025-01-01', 60, 8)]
    expect(countPersonalRecords(sessions)).toBe(0)
  })

  it('ignores warm-ups and incomplete entries', () => {
    const sessions = [
      log('2025-01-01', 50, 8),
      log('2025-01-03', 100, 20, { isWarmup: true }),
      log('2025-01-05', 100, 20, { completed: false }),
    ]
    expect(countPersonalRecords(sessions)).toBe(0)
  })
})
