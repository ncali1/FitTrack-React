import { create } from 'zustand'
import type { Exercise } from '@/types'
import { storageService } from '@/services/storage'
import { validateExerciseForm } from '@/utils/validators'
import { useAuthStore } from '@/stores/auth'
import { syncUpsertExercise, syncDeleteExercise } from '@/services/cloudSync'

interface ExercisesState {
  exercises: Exercise[]
  loading: boolean
  error: string | null

  exerciseById: (id: string) => Exercise | undefined
  createExercise: (
    name: string,
    targetSets: number,
    targetReps: number,
    targetMuscleGroups: string[]
  ) => Promise<Exercise>
  updateExercise: (id: string, updates: Partial<Omit<Exercise, 'id' | 'createdAt'>>) => Promise<Exercise>
  deleteExercise: (id: string) => Promise<void>
  loadExercises: () => Promise<void>
}

/**
 * Zustand store for managing the exercise library, backed by IndexedDB.
 */
export const useExercisesStore = create<ExercisesState>()((set, get) => ({
  exercises: [],
  loading: false,
  error: null,

  exerciseById: (id) => get().exercises.find((ex) => ex.id === id),

  createExercise: async (name, targetSets, targetReps, targetMuscleGroups) => {
    set({ loading: true, error: null })
    try {
      const errors = validateExerciseForm({ name, targetSets, targetReps, targetMuscleGroups })
      const firstError = Object.values(errors)[0]
      if (firstError) throw new Error(firstError)

      const now = Date.now()
      const exercise: Exercise = {
        id: crypto.randomUUID(),
        name: name.trim(),
        targetSets,
        targetReps,
        targetMuscleGroups,
        createdAt: now,
        updatedAt: now,
      }

      set((state) => ({ exercises: [...state.exercises, exercise] }))
      await storageService.saveExercise(exercise)

      // Fire-and-forget cloud push — never blocks the UI; queued locally on failure
      // and retried automatically (see services/cloudSync.ts).
      const authUser = useAuthStore.getState().user
      if (authUser) syncUpsertExercise(authUser.id, exercise)

      return exercise
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create exercise' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  updateExercise: async (id, updates) => {
    set({ loading: true, error: null })
    try {
      const existing = get().exercises.find((ex) => ex.id === id)
      if (!existing) {
        throw new Error('Exercise not found')
      }

      const merged = {
        name: updates.name ?? existing.name,
        targetSets: updates.targetSets ?? existing.targetSets,
        targetReps: updates.targetReps ?? existing.targetReps,
        targetMuscleGroups: updates.targetMuscleGroups ?? existing.targetMuscleGroups,
      }
      const errors = validateExerciseForm(merged)
      const firstError = Object.values(errors)[0]
      if (firstError) throw new Error(firstError)

      const updated: Exercise = {
        id: existing.id,
        name: merged.name.trim(),
        targetSets: merged.targetSets,
        targetReps: merged.targetReps,
        targetMuscleGroups: merged.targetMuscleGroups,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
      }

      set((state) => ({
        exercises: state.exercises.map((ex) => (ex.id === id ? updated : ex)),
      }))
      await storageService.saveExercise(updated)

      const authUser = useAuthStore.getState().user
      if (authUser) syncUpsertExercise(authUser.id, updated)

      return updated
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update exercise' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  deleteExercise: async (id) => {
    set({ loading: true, error: null })
    try {
      set((state) => ({ exercises: state.exercises.filter((ex) => ex.id !== id) }))
      await storageService.deleteExercise(id)

      const authUser = useAuthStore.getState().user
      if (authUser) syncDeleteExercise(authUser.id, id)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete exercise' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  loadExercises: async () => {
    set({ loading: true, error: null })
    try {
      const loaded = await storageService.getAllExercises()
      set({ exercises: loaded })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load exercises' })
      throw err
    } finally {
      set({ loading: false })
    }
  },
}))
