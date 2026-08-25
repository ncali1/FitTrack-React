import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useExercisesStore } from './exercises'

vi.mock('@/services/storage', () => ({
  storageService: {
    saveExercise: vi.fn(async () => {}),
    getExercise: vi.fn(async () => undefined),
    getAllExercises: vi.fn(async () => []),
    deleteExercise: vi.fn(async () => {}),
    saveRoutine: vi.fn(async () => {}),
    getAllRoutines: vi.fn(async () => []),
    deleteRoutine: vi.fn(async () => {}),
    saveWorkoutSession: vi.fn(async () => {}),
    getWorkoutSession: vi.fn(async () => undefined),
    getWorkoutSessionByDate: vi.fn(async () => undefined),
    getAllWorkoutSessions: vi.fn(async () => []),
    deleteWorkoutSession: vi.fn(async () => {}),
    clearAllData: vi.fn(async () => {}),
  },
}))

const INITIAL_STATE = useExercisesStore.getState()

describe('useExercisesStore', () => {
  beforeEach(() => {
    useExercisesStore.setState(INITIAL_STATE, true)
  })

  describe('Creating exercises', () => {
    it('creates an exercise with valid data', async () => {
      const exercise = await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest', 'Triceps'])

      expect(exercise.name).toBe('Bench Press')
      expect(exercise.targetSets).toBe(3)
      expect(exercise.targetReps).toBe(10)
      expect(exercise.targetMuscleGroups).toEqual(['Chest', 'Triceps'])
      expect(useExercisesStore.getState().exercises).toHaveLength(1)
    })

    it('rejects an exercise with an empty name', async () => {
      await expect(useExercisesStore.getState().createExercise('', 3, 10, ['Chest'])).rejects.toThrow(
        'Exercise name is required'
      )
    })

    it('rejects an exercise with invalid sets or reps', async () => {
      const { createExercise } = useExercisesStore.getState()
      await expect(createExercise('Bench Press', 0, 10, ['Chest'])).rejects.toThrow()
      await expect(createExercise('Bench Press', -1, 10, ['Chest'])).rejects.toThrow()
      await expect(createExercise('Bench Press', 3, 0, ['Chest'])).rejects.toThrow()
    })

    it('rejects an exercise with no muscle groups', async () => {
      await expect(useExercisesStore.getState().createExercise('Bench Press', 3, 10, [])).rejects.toThrow(
        'At least one muscle group must be selected'
      )
    })
  })

  describe('Editing exercises', () => {
    it('updates exercise fields', async () => {
      const { createExercise, updateExercise } = useExercisesStore.getState()
      const exercise = await createExercise('Bench Press', 3, 10, ['Chest'])

      const updated = await updateExercise(exercise.id, {
        name: 'Incline Bench Press',
        targetSets: 4,
        targetReps: 8,
        targetMuscleGroups: ['Chest', 'Shoulders'],
      })

      expect(updated.name).toBe('Incline Bench Press')
      expect(updated.targetSets).toBe(4)
      expect(updated.createdAt).toBe(exercise.createdAt)
    })

    it('rejects an update that would make the exercise invalid', async () => {
      const { createExercise, updateExercise } = useExercisesStore.getState()
      const exercise = await createExercise('Bench Press', 3, 10, ['Chest'])

      await expect(updateExercise(exercise.id, { targetSets: 0 })).rejects.toThrow()
    })

    it('throws when updating a non-existent exercise', async () => {
      await expect(useExercisesStore.getState().updateExercise('missing-id', { name: 'X' })).rejects.toThrow(
        'Exercise not found'
      )
    })
  })

  describe('Deleting exercises', () => {
    it('removes the exercise from state', async () => {
      const { createExercise, deleteExercise } = useExercisesStore.getState()
      const exercise = await createExercise('Bench Press', 3, 10, ['Chest'])
      expect(useExercisesStore.getState().exercises).toHaveLength(1)

      await deleteExercise(exercise.id)
      expect(useExercisesStore.getState().exercises).toHaveLength(0)
    })

    it('does not throw when deleting a non-existent exercise', async () => {
      await expect(useExercisesStore.getState().deleteExercise('missing-id')).resolves.not.toThrow()
    })
  })

  describe('Lookups', () => {
    it('exerciseById finds an exercise and returns undefined for an unknown id', async () => {
      const { createExercise, exerciseById } = useExercisesStore.getState()
      const created = await createExercise('Bench Press', 3, 10, ['Chest'])

      expect(exerciseById(created.id)?.name).toBe('Bench Press')
      expect(exerciseById('missing-id')).toBeUndefined()
    })
  })

  describe('Error state', () => {
    it('sets an error message on a failed create', async () => {
      const { createExercise } = useExercisesStore.getState()
      await createExercise('', 3, 10, ['Chest']).catch(() => {})
      expect(useExercisesStore.getState().error).toBeTruthy()
    })

    it('clears the error after a subsequent successful operation', async () => {
      const { createExercise } = useExercisesStore.getState()
      await createExercise('', 3, 10, ['Chest']).catch(() => {})
      await createExercise('Bench Press', 3, 10, ['Chest'])
      expect(useExercisesStore.getState().error).toBeNull()
    })
  })
})
