import { describe, it, expect } from 'vitest'
import { calculateMuscleGroupSets } from './muscleBalance'
import { createMockExercise, createMockWorkoutSession, createMockExercisePerformance } from '@/tests/factories'

describe('calculateMuscleGroupSets', () => {
  it('returns an empty array when there are no sessions in range', () => {
    expect(calculateMuscleGroupSets([], [], '2025-01-01', '2025-01-31')).toEqual([])
  })

  it('sums completed sets per muscle group across sessions', () => {
    const bench = createMockExercise({ id: 'bench', targetMuscleGroups: ['Chest', 'Triceps'] })
    const squat = createMockExercise({ id: 'squat', targetMuscleGroups: ['Quadriceps'] })
    const sessions = [
      createMockWorkoutSession({
        date: '2025-01-06',
        exercises: [createMockExercisePerformance({ exerciseId: 'bench', actualSets: 4 })],
      }),
      createMockWorkoutSession({
        date: '2025-01-08',
        exercises: [createMockExercisePerformance({ exerciseId: 'squat', actualSets: 3 })],
      }),
    ]

    const result = calculateMuscleGroupSets(sessions, [bench, squat], '2025-01-01', '2025-01-31')

    expect(result).toEqual([
      { group: 'Chest', sets: 4 },
      { group: 'Triceps', sets: 4 },
      { group: 'Quadriceps', sets: 3 },
    ])
  })

  it('attributes the full set count to every tagged muscle group, not split between them', () => {
    const exercise = createMockExercise({ id: 'row', targetMuscleGroups: ['Back', 'Biceps'] })
    const sessions = [
      createMockWorkoutSession({
        date: '2025-01-06',
        exercises: [createMockExercisePerformance({ exerciseId: 'row', actualSets: 5 })],
      }),
    ]

    const result = calculateMuscleGroupSets(sessions, [exercise], '2025-01-01', '2025-01-31')

    expect(result.find((r) => r.group === 'Back')?.sets).toBe(5)
    expect(result.find((r) => r.group === 'Biceps')?.sets).toBe(5)
  })

  it('excludes sessions outside the date range', () => {
    const exercise = createMockExercise({ id: 'bench', targetMuscleGroups: ['Chest'] })
    const sessions = [
      createMockWorkoutSession({
        date: '2024-12-01',
        exercises: [createMockExercisePerformance({ exerciseId: 'bench', actualSets: 4 })],
      }),
    ]

    expect(calculateMuscleGroupSets(sessions, [exercise], '2025-01-01', '2025-01-31')).toEqual([])
  })

  it('ignores incomplete performances', () => {
    const exercise = createMockExercise({ id: 'bench', targetMuscleGroups: ['Chest'] })
    const sessions = [
      createMockWorkoutSession({
        date: '2025-01-06',
        exercises: [createMockExercisePerformance({ exerciseId: 'bench', completed: false, actualSets: 4 })],
      }),
    ]

    expect(calculateMuscleGroupSets(sessions, [exercise], '2025-01-01', '2025-01-31')).toEqual([])
  })

  it('sorts descending by set count', () => {
    const a = createMockExercise({ id: 'a', targetMuscleGroups: ['Core'] })
    const b = createMockExercise({ id: 'b', targetMuscleGroups: ['Back'] })
    const sessions = [
      createMockWorkoutSession({
        date: '2025-01-06',
        exercises: [
          createMockExercisePerformance({ exerciseId: 'a', actualSets: 2 }),
          createMockExercisePerformance({ exerciseId: 'b', actualSets: 8 }),
        ],
      }),
    ]

    const result = calculateMuscleGroupSets(sessions, [a, b], '2025-01-01', '2025-01-31')
    expect(result.map((r) => r.group)).toEqual(['Back', 'Core'])
  })
})
