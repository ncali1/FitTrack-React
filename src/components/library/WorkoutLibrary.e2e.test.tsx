/**
 * End-to-end tests for the Workout Library: searching, muscle-group filtering, the
 * "Add to Workout" flow (copies a catalog entry into the user's own Exercises list), and
 * that each card renders its muscle diagram.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkoutLibrary } from './WorkoutLibrary'
import { useExercisesStore } from '@/stores/exercises'

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
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { storageService } from '@/services/storage'
import { toast } from 'sonner'
const mockedStorage = vi.mocked(storageService)
const mockedToast = vi.mocked(toast)

const INITIAL_STATE = useExercisesStore.getState()

describe('E2E: Workout Library', () => {
  beforeEach(() => {
    useExercisesStore.setState(INITIAL_STATE, true)
    vi.clearAllMocks()
  })

  it('filters the catalog by name search', async () => {
    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    await user.type(screen.getByLabelText(/search workout library/i), 'deadlift')

    expect(screen.getByRole('heading', { name: 'Deadlift' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Romanian Deadlift' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Barbell Bench Press' })).toBeNull()
  })

  it('shows a "No matches" state when the search has no results', async () => {
    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    await user.type(screen.getByLabelText(/search workout library/i), 'nonexistent workout xyz')

    expect(screen.getByText(/no matches/i)).toBeTruthy()
  })

  it('filters by a muscle-group chip', async () => {
    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    await user.click(screen.getByRole('button', { name: 'Calves' }))

    expect(screen.getByRole('heading', { name: 'Standing Calf Raise' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Barbell Bench Press' })).toBeNull()
  })

  it('"All" restores the full catalog', async () => {
    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    await user.click(screen.getByRole('button', { name: 'Calves' }))
    await user.click(screen.getByRole('button', { name: 'All' }))

    expect(screen.getByRole('heading', { name: 'Barbell Bench Press' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Standing Calf Raise' })).toBeTruthy()
  })

  it('adds a workout to the user\'s exercises, shows a success toast, and marks it Added', async () => {
    const user = userEvent.setup()
    render(<WorkoutLibrary />)

    const card = screen.getByRole('heading', { name: 'Barbell Bench Press' }).closest<HTMLElement>('.card-pad')!
    await user.click(within(card).getByRole('button', { name: /add to workout/i }))

    await waitFor(() => {
      expect(mockedStorage.saveExercise).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Barbell Bench Press', targetSets: 4, targetReps: 8 })
      )
    })
    expect(mockedToast.success).toHaveBeenCalledWith(expect.stringMatching(/barbell bench press/i))
    expect(within(card).getByRole('button', { name: /added/i })).toBeTruthy()
    expect(within(card).getByRole('button', { name: /added/i })).toBeDisabled()
  })

  it('shows "Added" instead of "Add to Workout" for a workout already in the user\'s exercises', () => {
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

    render(<WorkoutLibrary />)

    const card = screen.getByRole('heading', { name: 'Barbell Bench Press' }).closest<HTMLElement>('.card-pad')!
    expect(within(card).getByRole('button', { name: /added/i })).toBeDisabled()
  })

  it('renders a front/back muscle diagram directly on each card', () => {
    render(<WorkoutLibrary />)

    const card = screen.getByRole('heading', { name: 'Barbell Bench Press' }).closest<HTMLElement>('.card-pad')!
    expect(within(card).getByRole('img', { name: /front of body/i })).toBeTruthy()
    expect(within(card).getByRole('img', { name: /back of body/i })).toBeTruthy()
  })
})
