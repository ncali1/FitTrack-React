import type { Exercise, Routine, WorkoutSession, ExercisePerformance } from '@/types'

export function createMockExercise(overrides?: Partial<Exercise>): Exercise {
  return {
    id: crypto.randomUUID(),
    name: 'Test Exercise',
    targetSets: 3,
    targetReps: 10,
    targetMuscleGroups: ['chest'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

export function createMockRoutine(overrides?: Partial<Routine>): Routine {
  return {
    id: crypto.randomUUID(),
    name: 'My Routine',
    isActive: true,
    weeklyAssignments: {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

export function createMockWorkoutSession(overrides?: Partial<WorkoutSession>): WorkoutSession {
  const today = new Date()
  const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return {
    id: crypto.randomUUID(),
    date: dateString,
    exercises: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

export function createMockExercisePerformance(overrides?: Partial<ExercisePerformance>): ExercisePerformance {
  return {
    exerciseId: crypto.randomUUID(),
    completed: true,
    actualSets: 3,
    actualReps: 10,
    weight: 50,
    difficultyLevel: 'moderate',
    timestamp: Date.now(),
    ...overrides,
  }
}
