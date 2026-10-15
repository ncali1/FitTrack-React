/**
 * End-to-end tests for the Workout Library: searching, region-based muscle-group
 * filtering, and the detail-dialog "Add to today" flow (adds the catalog entry to the
 * user's own exercises if not already there, then assigns it to today's routine day in
 * one step).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkoutLibrary } from './WorkoutLibrary'
import { useExercisesStore } from '@/stores/exercises'
import { useRoutineStore } from '@/stores/routine'
import { useWorkoutTemplatesStore } from '@/stores/workoutTemplates'
import { getDayOfWeek } from '@/utils/calculations'

vi.mock('@/services/storage', () => ({
  storageService: {
    saveExercise: vi.fn(async () => {}),
    getExercise: vi.fn(async () => undefined),
    getAllExercises: vi.fn(async () => []),
    deleteExercise: vi.fn(async () => {}),
    saveRoutine: vi.fn(async () => {}),
    getAllRoutines: vi.fn(async () => []),
    deleteRoutine: vi.fn(async () => {}),
    saveWorkoutTemplate: vi.fn(async () => {}),
    getAllWorkoutTemplates: vi.fn(async () => []),
    deleteWorkoutTemplate: vi.fn(async () => {}),
    saveWorkoutSession: vi.fn(async () => {}),
    getWorkoutSession: vi.fn(async () => undefined),
    getWorkoutSessionByDate: vi.fn(async () => undefined),
    getAllWorkoutSessions: vi.fn(async () => []),
    deleteWorkoutSession: vi.fn(async () => {}),
    clearAllData: vi.fn(async () => {}),
  },
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

import { storageService } from '@/services/storage'
import { toast } from 'sonner'
const mockedStorage = vi.mocked(storageService)
const mockedToast = vi.mocked(toast)

const INITIAL_EXERCISES = useExercisesStore.getState()
const INITIAL_ROUTINES = useRoutineStore.getState()
const INITIAL_TEMPLATES = useWorkoutTemplatesStore.getState()

const TODAY = getDayOfWeek(
  (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
)

describe('E2E: Workout Library', () => {
  beforeEach(() => {
    useExercisesStore.setState(INITIAL_EXERCISES, true)
    useRoutineStore.setState(INITIAL_ROUTINES, true)
    useWorkoutTemplatesStore.setState(INITIAL_TEMPLATES, true)
    vi.clearAllMocks()
  })

  it('filters the catalog by name search', async () => {
    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    await user.type(screen.getByLabelText(/search workout library/i), 'deadlift')

    expect(screen.getByRole('heading', { level: 3, name: 'Deadlift' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Romanian Deadlift' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 3, name: 'Barbell Bench Press' })).toBeNull()
  })

  it('shows a "No matches" state when the search has no results', async () => {
    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    await user.type(screen.getByLabelText(/search workout library/i), 'nonexistent workout xyz')

    expect(screen.getByText(/no matches/i)).toBeTruthy()
  })

  it('filters by a region chip that groups several raw muscle groups', async () => {
    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    // "Legs" groups Quadriceps/Hamstrings/Glutes/Calves — Standing Calf Raise (Calves)
    // should show, Barbell Bench Press (Chest) should not.
    await user.click(screen.getByRole('button', { name: 'Legs' }))

    expect(screen.getByRole('heading', { level: 3, name: 'Standing Calf Raise' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 3, name: 'Barbell Bench Press' })).toBeNull()
  })

  it('"All" restores the full catalog', async () => {
    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    await user.click(screen.getByRole('button', { name: 'Legs' }))
    await user.click(screen.getByRole('button', { name: 'All' }))

    expect(screen.getByRole('heading', { level: 3, name: 'Barbell Bench Press' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Standing Calf Raise' })).toBeTruthy()
  })

  it('tapping a result opens a detail dialog with its target and muscle groups', async () => {
    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    await user.click(screen.getByRole('heading', { level: 3, name: 'Barbell Bench Press' }))

    const dialogTitle = screen.getByRole('heading', { level: 2, name: 'Barbell Bench Press' })
    const dialog = dialogTitle.closest('.modal-panel') as HTMLElement
    expect(within(dialog).getByText('Target: 4×8')).toBeTruthy()
    expect(within(dialog).getByText('Chest')).toBeTruthy()
  })

  it('"Close" dismisses the dialog without adding anything', async () => {
    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    await user.click(screen.getByRole('heading', { level: 3, name: 'Barbell Bench Press' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('heading', { level: 2, name: 'Barbell Bench Press' })).toBeNull()
    expect(mockedStorage.saveExercise).not.toHaveBeenCalled()
    expect(mockedStorage.saveRoutine).not.toHaveBeenCalled()
  })

  it('"Add to today" creates the exercise and assigns it to today, with a success toast', async () => {
    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    await user.click(screen.getByRole('heading', { level: 3, name: 'Barbell Bench Press' }))
    await user.click(screen.getByRole('button', { name: /add to today/i }))

    await waitFor(() => {
      expect(mockedStorage.saveExercise).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Barbell Bench Press', targetSets: 4, targetReps: 8 })
      )
    })
    await waitFor(() => {
      expect(mockedStorage.saveRoutine).toHaveBeenCalledWith(
        expect.objectContaining({ weeklyAssignments: expect.objectContaining({ [TODAY]: expect.any(Array) }) })
      )
    })
    expect(mockedToast.success).toHaveBeenCalledWith(expect.stringMatching(/added to today/i))
    expect(screen.queryByRole('heading', { level: 2, name: 'Barbell Bench Press' })).toBeNull()
  })

  it('reuses an exercise already in the user\'s library instead of creating a duplicate', async () => {
    useExercisesStore.setState({
      exercises: [
        {
          id: 'existing-1',
          name: 'Barbell Bench Press',
          targetSets: 4,
          targetReps: 8,
          targetMuscleGroups: ['Chest'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      loading: false,
      error: null,
    })

    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    await user.click(screen.getByRole('heading', { level: 3, name: 'Barbell Bench Press' }))
    await user.click(screen.getByRole('button', { name: /add to today/i }))

    await waitFor(() => {
      expect(mockedStorage.saveRoutine).toHaveBeenCalledWith(
        expect.objectContaining({
          weeklyAssignments: expect.objectContaining({ [TODAY]: ['existing-1'] }),
        })
      )
    })
    expect(mockedStorage.saveExercise).not.toHaveBeenCalled()
  })

  it('shows a neutral message instead of duplicating an assignment already in today\'s plan', async () => {
    useExercisesStore.setState({
      exercises: [
        {
          id: 'existing-1',
          name: 'Barbell Bench Press',
          targetSets: 4,
          targetReps: 8,
          targetMuscleGroups: ['Chest'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      loading: false,
      error: null,
    })
    useRoutineStore.setState({
      routines: [
        {
          id: 'routine-1',
          name: 'My Routine',
          isActive: true,
          weeklyAssignments: { ...INITIAL_ROUTINES.routines[0]?.weeklyAssignments, [TODAY]: ['existing-1'] },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    })

    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    await user.click(screen.getByRole('heading', { level: 3, name: 'Barbell Bench Press' }))
    await user.click(screen.getByRole('button', { name: /add to today/i }))

    await waitFor(() => {
      expect(mockedToast).toHaveBeenCalledWith(expect.stringMatching(/already in today/i))
    })
    expect(mockedStorage.saveRoutine).not.toHaveBeenCalled()
  })

  describe('"Add to routine"', () => {
    const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('heading', { level: 3, name: 'Barbell Bench Press' }))
      await user.click(screen.getByRole('button', { name: 'Add to routine' }))
    }

    it('adds the exercise to an existing routine, creating it in the user\'s library first', async () => {
      const user = userEvent.setup()
      const routine = await useWorkoutTemplatesStore.getState().createTemplate('Push Day', ['other'])
      render(<WorkoutLibrary />)

      await openPicker(user)
      await user.click(screen.getByRole('button', { name: 'Add to Push Day' }))

      await waitFor(() => {
        expect(useWorkoutTemplatesStore.getState().templates[0]?.exerciseIds).toHaveLength(2)
      })
      const bench = useExercisesStore.getState().exercises.find((e) => e.name === 'Barbell Bench Press')
      expect(bench).toMatchObject({ targetSets: 4, targetReps: 8 })
      expect(useWorkoutTemplatesStore.getState().templates[0]).toMatchObject({
        id: routine.id,
        exerciseIds: ['other', bench!.id],
      })
      expect(mockedToast.success).toHaveBeenCalledWith('Added to Push Day')
      expect(screen.queryByRole('heading', { level: 2, name: 'Barbell Bench Press' })).toBeNull()
      // Adding to a routine leaves today's plan alone.
      expect(mockedStorage.saveRoutine).not.toHaveBeenCalled()
    })

    it('creates a new routine containing the exercise', async () => {
      const user = userEvent.setup()
      render(<WorkoutLibrary />)

      await openPicker(user)
      await user.click(screen.getByRole('button', { name: '+ New routine' }))
      await user.type(screen.getByLabelText('Routine name'), 'Chest Day')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(useWorkoutTemplatesStore.getState().templates).toHaveLength(1)
      })
      const bench = useExercisesStore.getState().exercises.find((e) => e.name === 'Barbell Bench Press')
      expect(useWorkoutTemplatesStore.getState().templates[0]).toMatchObject({
        name: 'Chest Day',
        exerciseIds: [bench!.id],
      })
    })

    it('marks a routine that already contains the exercise instead of adding it twice', async () => {
      const user = userEvent.setup()
      const bench = await useExercisesStore.getState().createExercise('barbell bench press', 3, 10, ['Chest'])
      await useWorkoutTemplatesStore.getState().createTemplate('Push Day', [bench.id])
      render(<WorkoutLibrary />)

      await openPicker(user)

      expect(screen.getByRole('button', { name: 'Already in Push Day' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Add to Push Day' })).toBeNull()
    })

    it('"Cancel" returns to the main actions without changing anything', async () => {
      const user = userEvent.setup()
      await useWorkoutTemplatesStore.getState().createTemplate('Push Day')
      render(<WorkoutLibrary />)

      await openPicker(user)
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.getByRole('button', { name: /add to today/i })).toBeTruthy()
      expect(useWorkoutTemplatesStore.getState().templates[0]?.exerciseIds).toEqual([])
      expect(mockedStorage.saveExercise).not.toHaveBeenCalled()
    })
  })

  describe('your own exercises in the same list', () => {
    it('lists a custom exercise alongside the catalog, marked Custom', async () => {
      await useExercisesStore.getState().createExercise('Landmine Press', 3, 10, ['Shoulders'])
      render(<WorkoutLibrary />)

      const row = screen.getByRole('heading', { level: 3, name: 'Landmine Press' }).closest('[role="button"]') as HTMLElement
      expect(within(row).getByText('Custom')).toBeTruthy()
      // A catalog entry has no Custom badge.
      const catalogRow = screen.getByRole('heading', { level: 3, name: 'Overhead Press' }).closest('[role="button"]') as HTMLElement
      expect(within(catalogRow).queryByText('Custom')).toBeNull()
    })

    it('shows a catalog entry only once after the user has their own copy of it, with their targets', async () => {
      await useExercisesStore.getState().createExercise('barbell bench press', 5, 5, ['Chest'])
      render(<WorkoutLibrary />)

      const rows = screen.getAllByRole('heading', { level: 3, name: /^barbell bench press$/i })
      expect(rows).toHaveLength(1)
      expect(within(rows[0]!.closest('[role="button"]') as HTMLElement).getByText(/^5×5/)).toBeTruthy()
    })

    it('includes custom exercises in search and muscle filters', async () => {
      const user = userEvent.setup()
      await useExercisesStore.getState().createExercise('Landmine Press', 3, 10, ['Shoulders'])
      render(<WorkoutLibrary />)

      await user.click(screen.getByRole('button', { name: 'Chest' }))
      expect(screen.queryByRole('heading', { level: 3, name: 'Landmine Press' })).toBeNull()
      await user.click(screen.getByRole('button', { name: 'Shoulders' }))
      expect(screen.getByRole('heading', { level: 3, name: 'Landmine Press' })).toBeTruthy()

      await user.type(screen.getByLabelText('Search workout library'), 'landmine')
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
    })

    it('tints each exercise icon by its main muscle group', () => {
      render(<WorkoutLibrary />)

      const iconTile = (name: string) =>
        (screen.getByRole('heading', { level: 3, name }).closest('[role="button"]') as HTMLElement).firstElementChild!
      expect(iconTile('Barbell Curl').className).toContain('pink')
      expect(iconTile('Back Squat').className).toContain('emerald')
      expect(iconTile('Barbell Curl').className).not.toBe(iconTile('Back Squat').className)
    })

    it('"Add exercise" creates a custom exercise that then appears in the list', async () => {
      const user = userEvent.setup()
      render(<WorkoutLibrary />)

      await user.click(screen.getByRole('button', { name: /add exercise/i }))
      await user.type(screen.getByLabelText(/name/i), 'Landmine Press')
      await user.click(screen.getByRole('checkbox', { name: 'Shoulders' }))
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('heading', { level: 3, name: 'Landmine Press' })).toBeTruthy()
      expect(useExercisesStore.getState().exercises.map((e) => e.name)).toEqual(['Landmine Press'])
    })

    it('offers Edit and Delete for a custom exercise, but not for a catalog entry', async () => {
      const user = userEvent.setup()
      await useExercisesStore.getState().createExercise('Landmine Press', 3, 10, ['Shoulders'])
      render(<WorkoutLibrary />)

      await user.click(screen.getByRole('heading', { level: 3, name: 'Overhead Press' }))
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
      await user.click(screen.getByRole('button', { name: 'Close' }))

      await user.click(screen.getByRole('heading', { level: 3, name: 'Landmine Press' }))
      expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()

      vi.stubGlobal('confirm', vi.fn(() => true))
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      vi.unstubAllGlobals()

      await waitFor(() => {
        expect(useExercisesStore.getState().exercises).toEqual([])
      })
      expect(screen.queryByRole('heading', { level: 3, name: 'Landmine Press' })).toBeNull()
    })

    it('adds a custom exercise to a routine without creating anything new', async () => {
      const user = userEvent.setup()
      const custom = await useExercisesStore.getState().createExercise('Landmine Press', 3, 10, ['Shoulders'])
      await useWorkoutTemplatesStore.getState().createTemplate('Push Day')
      render(<WorkoutLibrary />)

      await user.click(screen.getByRole('heading', { level: 3, name: 'Landmine Press' }))
      await user.click(screen.getByRole('button', { name: 'Add to routine' }))
      await user.click(screen.getByRole('button', { name: 'Add to Push Day' }))

      await waitFor(() => {
        expect(useWorkoutTemplatesStore.getState().templates[0]?.exerciseIds).toEqual([custom.id])
      })
      expect(useExercisesStore.getState().exercises).toHaveLength(1)
    })
  })
})
