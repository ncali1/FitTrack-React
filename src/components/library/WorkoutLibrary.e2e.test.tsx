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
})
