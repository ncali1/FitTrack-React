import { create } from 'zustand'
import type { WorkoutTemplate } from '@/types'
import { storageService } from '@/services/storage'
import { useWorkoutSessionsStore } from './workoutSessions'
import { useRoutineStore } from './routine'
import { useAuthStore } from './auth'
import { syncUpsertWorkoutTemplate, syncDeleteWorkoutTemplate } from '@/services/cloudSync'

interface WorkoutTemplatesState {
  templates: WorkoutTemplate[]
  error: string | null

  createTemplate: (name: string, exerciseIds?: string[]) => Promise<WorkoutTemplate>
  renameTemplate: (id: string, name: string) => Promise<void>
  /** Replaces a template's exercise list — used for adding, removing, and reordering. */
  setTemplateExercises: (id: string, exerciseIds: string[]) => Promise<void>
  /** Copies a template (named "<name> copy") and returns the copy. */
  duplicateTemplate: (id: string) => Promise<WorkoutTemplate | null>
  /** Deletes a template and unassigns it from every day it was scheduled on. */
  deleteTemplate: (id: string) => Promise<void>
  loadTemplates: () => Promise<void>
}

/**
 * Zustand store for workout templates — the reusable, named exercise lists the UI calls
 * "routines" (see {@link WorkoutTemplate} for the naming). Which days they are scheduled
 * on lives on the weekly program, in the routine store.
 */
export const useWorkoutTemplatesStore = create<WorkoutTemplatesState>()((set, get) => {
  /** Writes a new or updated template to state, IndexedDB, and the cloud. */
  const persist = async (template: WorkoutTemplate) => {
    set((state) => ({
      templates: state.templates.some((t) => t.id === template.id)
        ? state.templates.map((t) => (t.id === template.id ? template : t))
        : [...state.templates, template],
    }))
    await storageService.saveWorkoutTemplate(template)
    // Weekly summaries and progress data are derived from the days these expand into.
    useWorkoutSessionsStore.getState().invalidateCache()

    const authUser = useAuthStore.getState().user
    if (authUser) syncUpsertWorkoutTemplate(authUser.id, template)
  }

  /** Runs a mutation, recording its failure on the store before re-throwing. */
  const guarded = async <T>(fallbackMessage: string, run: () => Promise<T>): Promise<T> => {
    set({ error: null })
    try {
      return await run()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : fallbackMessage })
      throw err
    }
  }

  const update = async (id: string, changes: Partial<Pick<WorkoutTemplate, 'name' | 'exerciseIds'>>) => {
    const target = get().templates.find((t) => t.id === id)
    if (!target) return
    await persist({ ...target, ...changes, updatedAt: Date.now() })
  }

  return {
    templates: [],
    error: null,

    createTemplate: (name, exerciseIds = []) =>
      guarded('Failed to create routine', async () => {
        const now = Date.now()
        const template: WorkoutTemplate = {
          id: crypto.randomUUID(),
          name: name.trim(),
          exerciseIds,
          createdAt: now,
          updatedAt: now,
        }
        await persist(template)
        return template
      }),

    renameTemplate: (id, name) => guarded('Failed to rename routine', () => update(id, { name: name.trim() })),

    setTemplateExercises: (id, exerciseIds) =>
      guarded('Failed to update routine', () => update(id, { exerciseIds: [...new Set(exerciseIds)] })),

    duplicateTemplate: (id) =>
      guarded('Failed to duplicate routine', async () => {
        const source = get().templates.find((t) => t.id === id)
        if (!source) return null

        const now = Date.now()
        const copy: WorkoutTemplate = {
          id: crypto.randomUUID(),
          name: `${source.name} copy`,
          exerciseIds: [...source.exerciseIds],
          createdAt: now,
          updatedAt: now,
        }
        await persist(copy)
        return copy
      }),

    deleteTemplate: (id) =>
      guarded('Failed to delete routine', async () => {
        await useRoutineStore.getState().removeTemplateFromAll(id)
        set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }))
        await storageService.deleteWorkoutTemplate(id)
        useWorkoutSessionsStore.getState().invalidateCache()

        const authUser = useAuthStore.getState().user
        if (authUser) syncDeleteWorkoutTemplate(authUser.id, id)
      }),

    loadTemplates: () =>
      guarded('Failed to load routines', async () => {
        set({ templates: await storageService.getAllWorkoutTemplates() })
      }),
  }
})
