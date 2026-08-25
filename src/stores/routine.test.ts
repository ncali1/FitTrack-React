import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useRoutineStore } from './routine'
import { useWorkoutSessionsStore } from './workoutSessions'

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

const INITIAL_ROUTINE_STATE = useRoutineStore.getState()
const INITIAL_SESSIONS_STATE = useWorkoutSessionsStore.getState()

describe('useRoutineStore', () => {
  beforeEach(() => {
    useRoutineStore.setState(INITIAL_ROUTINE_STATE, true)
    useWorkoutSessionsStore.setState(INITIAL_SESSIONS_STATE, true)
  })

  describe('Assigning exercises to days', () => {
    it('assigns an exercise to a day', async () => {
      await useRoutineStore.getState().assignExercise('monday', 'ex1')
      expect(useRoutineStore.getState().routineForDay('monday')).toContain('ex1')
    })

    it('assigns multiple exercises to the same day', async () => {
      const { assignExercise, routineForDay } = useRoutineStore.getState()
      await assignExercise('monday', 'ex1')
      await assignExercise('monday', 'ex2')
      expect(routineForDay('monday')).toEqual(['ex1', 'ex2'])
    })

    it('does not add a duplicate exercise to the same day', async () => {
      const { assignExercise, routineForDay } = useRoutineStore.getState()
      await assignExercise('monday', 'ex1')
      await assignExercise('monday', 'ex1')
      expect(routineForDay('monday')).toHaveLength(1)
    })

    it('assigns the same exercise to different days independently', async () => {
      const { assignExercise, routineForDay } = useRoutineStore.getState()
      await assignExercise('monday', 'ex1')
      await assignExercise('wednesday', 'ex1')
      expect(routineForDay('monday')).toContain('ex1')
      expect(routineForDay('wednesday')).toContain('ex1')
    })

    it('treats day names case-insensitively', async () => {
      await useRoutineStore.getState().assignExercise('MONDAY', 'ex1')
      expect(useRoutineStore.getState().routineForDay('monday')).toContain('ex1')
    })
  })

  describe('Removing exercises from days', () => {
    it('removes an exercise from a day', async () => {
      const { assignExercise, removeExercise, routineForDay } = useRoutineStore.getState()
      await assignExercise('monday', 'ex1')
      await removeExercise('monday', 'ex1')
      expect(routineForDay('monday')).toHaveLength(0)
    })

    it('removes only the specified exercise, leaving others on the same day', async () => {
      const { assignExercise, removeExercise, routineForDay } = useRoutineStore.getState()
      await assignExercise('monday', 'ex1')
      await assignExercise('monday', 'ex2')
      await removeExercise('monday', 'ex1')
      expect(routineForDay('monday')).toEqual(['ex2'])
    })

    it('does not throw when removing from a day with no routine yet', async () => {
      await expect(useRoutineStore.getState().removeExercise('monday', 'missing')).resolves.not.toThrow()
    })

    it('does not affect other days', async () => {
      const { assignExercise, removeExercise, routineForDay } = useRoutineStore.getState()
      await assignExercise('monday', 'ex1')
      await assignExercise('wednesday', 'ex1')
      await removeExercise('monday', 'ex1')
      expect(routineForDay('wednesday')).toContain('ex1')
    })
  })

  describe('Lazy routine creation', () => {
    it('lazily creates the first routine as "My Routine", marked active', async () => {
      await useRoutineStore.getState().assignExercise('monday', 'ex1')

      const state = useRoutineStore.getState()
      expect(state.routines).toHaveLength(1)
      expect(state.activeRoutine()?.name).toBe('My Routine')
      expect(state.activeRoutine()?.isActive).toBe(true)
    })

    it('loadRoutines seeds an empty routine with all 7 days when none exist', async () => {
      await useRoutineStore.getState().loadRoutines()

      const routine = useRoutineStore.getState().activeRoutine()
      expect(routine).toBeDefined()
      expect(Object.keys(routine!.weeklyAssignments)).toHaveLength(7)
      expect(useRoutineStore.getState().routineForDay('monday')).toHaveLength(0)
    })
  })

  describe('Multiple routines', () => {
    it('createRoutine adds a new, initially-inactive routine', async () => {
      await useRoutineStore.getState().createRoutine('Push/Pull/Legs')

      const state = useRoutineStore.getState()
      expect(state.routines).toHaveLength(1)
      expect(state.routines[0]!.name).toBe('Push/Pull/Legs')
      expect(state.routines[0]!.isActive).toBe(false)
    })

    it('renameRoutine updates the name', async () => {
      const { createRoutine, renameRoutine } = useRoutineStore.getState()
      const created = await createRoutine('5x5')
      await renameRoutine(created.id, 'Starting Strength')

      expect(useRoutineStore.getState().routines.find((r) => r.id === created.id)?.name).toBe('Starting Strength')
    })

    it('setActiveRoutine switches the active routine and keeps assignments separate', async () => {
      const { assignExercise, activeRoutine, createRoutine, setActiveRoutine, routineForDay } =
        useRoutineStore.getState()

      await assignExercise('monday', 'bench-press')
      const firstId = activeRoutine()!.id

      const second = await createRoutine('5x5')
      await setActiveRoutine(second.id)
      await useRoutineStore.getState().assignExercise('monday', 'squat')

      expect(useRoutineStore.getState().activeRoutine()?.id).toBe(second.id)
      expect(routineForDay('monday')).toContain('squat')
      expect(routineForDay('monday')).not.toContain('bench-press')

      await useRoutineStore.getState().setActiveRoutine(firstId)
      expect(useRoutineStore.getState().routineForDay('monday')).toContain('bench-press')
      expect(useRoutineStore.getState().routineForDay('monday')).not.toContain('squat')
    })

    it('setActiveRoutine invalidates the workout-sessions caches', async () => {
      const { assignExercise, createRoutine, setActiveRoutine } = useRoutineStore.getState()
      const invalidateSpy = vi.spyOn(useWorkoutSessionsStore.getState(), 'invalidateCache')

      await assignExercise('monday', 'ex1')
      const second = await createRoutine('5x5')

      invalidateSpy.mockClear()
      await setActiveRoutine(second.id)

      expect(invalidateSpy).toHaveBeenCalled()
    })

    it('deleteRoutine refuses to delete the last remaining routine', async () => {
      const { assignExercise, activeRoutine, deleteRoutine } = useRoutineStore.getState()
      await assignExercise('monday', 'ex1') // lazily creates the only routine

      await expect(deleteRoutine(activeRoutine()!.id)).rejects.toThrow()
      expect(useRoutineStore.getState().routines).toHaveLength(1)
    })

    it('deleteRoutine auto-activates another routine when the active one is deleted', async () => {
      const { assignExercise, activeRoutine, createRoutine, deleteRoutine } = useRoutineStore.getState()
      await assignExercise('monday', 'ex1')
      const firstId = activeRoutine()!.id
      const second = await createRoutine('5x5')

      await deleteRoutine(firstId)

      const state = useRoutineStore.getState()
      expect(state.routines).toHaveLength(1)
      expect(state.activeRoutine()?.id).toBe(second.id)
      expect(state.activeRoutine()?.isActive).toBe(true)
    })

    it('deleteRoutine leaves the active routine untouched when deleting an inactive one', async () => {
      const { assignExercise, activeRoutine, createRoutine, deleteRoutine } = useRoutineStore.getState()
      await assignExercise('monday', 'ex1')
      const activeId = activeRoutine()!.id
      const second = await createRoutine('5x5')

      await deleteRoutine(second.id)

      const state = useRoutineStore.getState()
      expect(state.routines).toHaveLength(1)
      expect(state.activeRoutine()?.id).toBe(activeId)
    })
  })
})
