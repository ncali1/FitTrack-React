import { create } from 'zustand'
import type { Routine, RoutineAssignment } from '@/types'
import { storageService } from '@/services/storage'
import { useWorkoutSessionsStore } from './workoutSessions'
import { useAuthStore } from './auth'
import { syncUpsertRoutine, syncDeleteRoutine } from '@/services/cloudSync'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function initializeAssignments(): RoutineAssignment {
  const assignments: RoutineAssignment = {}
  DAYS.forEach((day) => {
    assignments[day] = []
  })
  return assignments
}

/**
 * Pure helpers operating on a `routines` array, exported so components can derive the
 * active routine / day assignments reactively by selecting the raw `routines` array
 * (e.g. `useRoutineStore((s) => s.routines)`) and computing from it in the render body.
 *
 * Prefer this over calling the store's own `activeRoutine()`/`routineForDay()` methods
 * from inside a component render: those methods are stable function references that
 * never change identity, so selecting them via `useRoutineStore((s) => s.routineForDay)`
 * and calling the result later does NOT subscribe the component to `routines` changes —
 * Zustand only re-renders when the *selected* value's reference changes. Calling these
 * pure helpers inside the selector itself (`useRoutineStore((s) => selectRoutineForDay(s.routines, day))`)
 * does subscribe correctly, since the selector re-runs and returns a new array/value
 * whenever `routines` changes.
 *
 * That "call it inside the selector" fix has its own trap, though: the function you call
 * must return a value that's referentially *stable* when the underlying data hasn't
 * changed (either the same object/array reference, or a new primitive that compares
 * equal). React's useSyncExternalStore (which Zustand's hook is built on) treats any new
 * object/array reference as a changed value — so calling an unmemoized function that
 * builds a fresh object every time (e.g. `calculatePersonalRecord`) inside a selector
 * causes an infinite render loop, not just a stale read. selectActiveRoutine/
 * selectRoutineForDay above are safe because a `.find()`/array-index lookup either
 * returns the *same* object already in `routines`/`weeklyAssignments` or a genuinely new
 * array only when the source data changed. The store's `getCached*` methods
 * (getCachedWeeklySummary, getCachedProgressData, getCachedExerciseHistory in
 * workoutSessions.ts) are also safe to call inside a selector for the same reason — they
 * memoize via a Map and return the same reference on a cache hit. For anything else
 * (e.g. deriving a personal record), select the raw reactive array and compute the
 * derived value as an ordinary render-body value (optionally `useMemo`'d) instead of
 * routing it through a Zustand selector.
 */
export function selectActiveRoutine(routines: Routine[]): Routine | null {
  return routines.find((r) => r.isActive) ?? routines[0] ?? null
}

export function selectRoutineForDay(routines: Routine[], day: string): string[] {
  const active = selectActiveRoutine(routines)
  if (!active) return []
  return active.weeklyAssignments[day.toLowerCase()] || []
}

interface RoutineState {
  routines: Routine[]
  loading: boolean
  error: string | null

  /** The routine currently marked active, or the first routine as a fallback. */
  activeRoutine: () => Routine | null
  routineForDay: (day: string) => string[]
  allAssignments: () => RoutineAssignment
  assignExercise: (day: string, exerciseId: string) => Promise<void>
  removeExercise: (day: string, exerciseId: string) => Promise<void>
  createRoutine: (name: string) => Promise<Routine>
  renameRoutine: (id: string, name: string) => Promise<void>
  deleteRoutine: (id: string) => Promise<void>
  setActiveRoutine: (id: string) => Promise<void>
  loadRoutines: () => Promise<void>
  saveRoutine: () => Promise<void>
}

/**
 * Zustand store for managing saved routines/programs (e.g. push/pull/legs, 5x5) — one of
 * which is "active" at a time and drives the daily checklist, weekly summary, and
 * progress graphs.
 */
export const useRoutineStore = create<RoutineState>()((set, get) => ({
  routines: [],
  loading: false,
  error: null,

  activeRoutine: () => selectActiveRoutine(get().routines),

  routineForDay: (day) => selectRoutineForDay(get().routines, day),

  allAssignments: () => selectActiveRoutine(get().routines)?.weeklyAssignments || {},

  assignExercise: async (day, exerciseId) => {
    set({ loading: true, error: null })
    try {
      let target = get().activeRoutine()
      if (!target) {
        target = {
          id: crypto.randomUUID(),
          name: 'My Routine',
          isActive: true,
          weeklyAssignments: initializeAssignments(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({ routines: [...state.routines, target!] }))
      }

      const dayLower = day.toLowerCase()
      const dayAssignments = target.weeklyAssignments[dayLower] ?? []
      if (dayAssignments.includes(exerciseId)) return

      const updated: Routine = {
        ...target,
        weeklyAssignments: { ...target.weeklyAssignments, [dayLower]: [...dayAssignments, exerciseId] },
        updatedAt: Date.now(),
      }

      set((state) => ({ routines: state.routines.map((r) => (r.id === updated.id ? updated : r)) }))
      await storageService.saveRoutine(updated)
      useWorkoutSessionsStore.getState().invalidateCache()

      const authUser = useAuthStore.getState().user
      if (authUser) syncUpsertRoutine(authUser.id, updated)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to assign exercise' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  removeExercise: async (day, exerciseId) => {
    set({ loading: true, error: null })
    try {
      const target = get().activeRoutine()
      if (!target) return

      const dayLower = day.toLowerCase()
      const dayAssignments = target.weeklyAssignments[dayLower]
      if (!dayAssignments) return

      const updated: Routine = {
        ...target,
        weeklyAssignments: {
          ...target.weeklyAssignments,
          [dayLower]: dayAssignments.filter((id) => id !== exerciseId),
        },
        updatedAt: Date.now(),
      }

      set((state) => ({ routines: state.routines.map((r) => (r.id === updated.id ? updated : r)) }))
      await storageService.saveRoutine(updated)
      useWorkoutSessionsStore.getState().invalidateCache()

      const authUser = useAuthStore.getState().user
      if (authUser) syncUpsertRoutine(authUser.id, updated)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to remove exercise' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  createRoutine: async (name) => {
    set({ loading: true, error: null })
    try {
      const created: Routine = {
        id: crypto.randomUUID(),
        name,
        isActive: false,
        weeklyAssignments: initializeAssignments(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      set((state) => ({ routines: [...state.routines, created] }))
      await storageService.saveRoutine(created)

      const authUser = useAuthStore.getState().user
      if (authUser) syncUpsertRoutine(authUser.id, created)

      return created
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create routine' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  renameRoutine: async (id, name) => {
    set({ loading: true, error: null })
    try {
      const target = get().routines.find((r) => r.id === id)
      if (!target) return

      const updated: Routine = { ...target, name, updatedAt: Date.now() }
      set((state) => ({ routines: state.routines.map((r) => (r.id === id ? updated : r)) }))
      await storageService.saveRoutine(updated)

      const authUser = useAuthStore.getState().user
      if (authUser) syncUpsertRoutine(authUser.id, updated)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to rename routine' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  /**
   * Deletes a routine. Refuses to delete the last remaining routine. If the active
   * routine is deleted, another routine (the most recently updated remaining one) is
   * automatically activated in its place.
   */
  deleteRoutine: async (id) => {
    set({ loading: true, error: null })
    try {
      const { routines } = get()
      if (routines.length <= 1) {
        throw new Error('Cannot delete the last remaining routine')
      }

      const wasActive = routines.find((r) => r.id === id)?.isActive ?? false
      let remaining = routines.filter((r) => r.id !== id)

      const authUser = useAuthStore.getState().user

      if (wasActive && remaining.length > 0) {
        const next = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0]!
        const activated: Routine = { ...next, isActive: true, updatedAt: Date.now() }
        remaining = remaining.map((r) => (r.id === activated.id ? activated : r))
        await storageService.saveRoutine(activated)
        useWorkoutSessionsStore.getState().invalidateCache()

        if (authUser) syncUpsertRoutine(authUser.id, activated)
      }

      set({ routines: remaining })
      await storageService.deleteRoutine(id)

      if (authUser) syncDeleteRoutine(authUser.id, id)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete routine' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  /**
   * Switches the active routine. Flips `isActive` on both the previously-active
   * routine and the target, persists both, and invalidates the workout-sessions
   * store's weekly-summary/progress caches.
   */
  setActiveRoutine: async (id) => {
    set({ loading: true, error: null })
    try {
      const target = get().routines.find((r) => r.id === id)
      if (!target || target.isActive) return

      const previous = get().activeRoutine()
      const now = Date.now()
      const deactivated = previous ? { ...previous, isActive: false, updatedAt: now } : null
      const activated: Routine = { ...target, isActive: true, updatedAt: now }

      set((state) => ({
        routines: state.routines.map((r) => {
          if (deactivated && r.id === deactivated.id) return deactivated
          if (r.id === activated.id) return activated
          return r
        }),
      }))

      if (deactivated) await storageService.saveRoutine(deactivated)
      await storageService.saveRoutine(activated)
      useWorkoutSessionsStore.getState().invalidateCache()

      const authUser = useAuthStore.getState().user
      if (authUser) {
        if (deactivated) syncUpsertRoutine(authUser.id, deactivated)
        syncUpsertRoutine(authUser.id, activated)
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to switch routine' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  /**
   * Loads all routines from IndexedDB.
   * Creates and initialises a new empty routine in memory if none exist yet.
   */
  loadRoutines: async () => {
    set({ loading: true, error: null })
    try {
      const loaded = await storageService.getAllRoutines()
      set({
        routines:
          loaded.length > 0
            ? loaded
            : [
                {
                  id: crypto.randomUUID(),
                  name: 'My Routine',
                  isActive: true,
                  weeklyAssignments: initializeAssignments(),
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              ],
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load routines' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  saveRoutine: async () => {
    set({ loading: true, error: null })
    try {
      const target = get().activeRoutine()
      if (target) {
        const updated: Routine = { ...target, updatedAt: Date.now() }
        set((state) => ({ routines: state.routines.map((r) => (r.id === updated.id ? updated : r)) }))
        await storageService.saveRoutine(updated)

        const authUser = useAuthStore.getState().user
        if (authUser) syncUpsertRoutine(authUser.id, updated)
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to save routine' })
      throw err
    } finally {
      set({ loading: false })
    }
  },
}))
