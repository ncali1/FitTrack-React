import { useExercisesStore } from '@/stores/exercises'
import type { LibraryWorkout } from '@/data/workoutLibrary'
import type { Exercise } from '@/types'

/** The user's own exercise matching a library entry by name (case-insensitive), if they have one. */
export function findExerciseForLibraryWorkout(workout: LibraryWorkout, exercises: Exercise[]): Exercise | undefined {
  return exercises.find((e) => e.name.toLowerCase() === workout.name.toLowerCase())
}

/**
 * Returns the user's exercise for a library entry, creating it from the entry's targets
 * the first time it's used — so adding from the library never duplicates an exercise the
 * user already has.
 */
export async function ensureExerciseFromLibrary(workout: LibraryWorkout): Promise<Exercise> {
  const { exercises, createExercise } = useExercisesStore.getState()
  return (
    findExerciseForLibraryWorkout(workout, exercises) ??
    (await createExercise(workout.name, workout.targetSets, workout.targetReps, [...workout.targetMuscleGroups]))
  )
}
