/**
 * End-to-end tests for ExerciseList: name search, muscle-group filter chips, their
 * combination, and the undo-able delete flow (hide immediately, commit to the store only
 * after the undo window elapses, Undo cancels the pending commit).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster, toast } from 'sonner'
import { ExerciseList } from './ExerciseList'
import { useExercisesStore } from '@/stores/exercises'
import { createMockExercise } from '@/tests/factories'

/** Renders ExerciseList alongside a real Toaster so the Undo action toast is queryable. */
function renderExerciseList() {
  return render(
    <>
      <ExerciseList />
      <Toaster />
    </>
  )
}

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

import { storageService } from '@/services/storage'
const mockedStorage = vi.mocked(storageService)

const INITIAL_STATE = useExercisesStore.getState()

const PUSH_UPS = createMockExercise({ id: 'ex-1', name: 'Push-ups', targetMuscleGroups: ['Chest', 'Triceps'] })
const PULL_UPS = createMockExercise({ id: 'ex-2', name: 'Pull-ups', targetMuscleGroups: ['Back', 'Biceps'] })
const SQUATS = createMockExercise({ id: 'ex-3', name: 'Squats', targetMuscleGroups: ['Legs', 'Glutes'] })

function seedExercises(exercises = [PUSH_UPS, PULL_UPS, SQUATS]) {
  useExercisesStore.setState({ exercises, loading: false, error: null })
}

describe('E2E: Exercise List – search, filter, and undo delete', () => {
  beforeEach(() => {
    useExercisesStore.setState(INITIAL_STATE, true)
    vi.clearAllMocks()
  })

  describe('search', () => {
    it('filters exercises by case-insensitive name substring', async () => {
      const user = userEvent.setup()
      seedExercises()
      render(<ExerciseList />)

      await user.type(screen.getByLabelText(/search exercises/i), 'squ')

      expect(screen.getByText('Squats')).toBeTruthy()
      expect(screen.queryByText('Push-ups')).toBeNull()
      expect(screen.queryByText('Pull-ups')).toBeNull()
    })

    it('shows a distinct "No matches" empty state when the search has no results', async () => {
      const user = userEvent.setup()
      seedExercises()
      render(<ExerciseList />)

      await user.type(screen.getByLabelText(/search exercises/i), 'nonexistent exercise')

      expect(screen.getByText(/no matches/i)).toBeTruthy()
      expect(screen.queryByText(/no exercises yet/i)).toBeNull()
    })

    it('clearing the search restores the full list', async () => {
      const user = userEvent.setup()
      seedExercises()
      render(<ExerciseList />)

      const searchInput = screen.getByLabelText(/search exercises/i)
      await user.type(searchInput, 'squ')
      expect(screen.queryByText('Push-ups')).toBeNull()

      await user.click(screen.getByLabelText(/clear search/i))

      expect((searchInput as HTMLInputElement).value).toBe('')
      expect(screen.getByText('Push-ups')).toBeTruthy()
      expect(screen.getByText('Pull-ups')).toBeTruthy()
      expect(screen.getByText('Squats')).toBeTruthy()
    })
  })

  describe('muscle-group filter', () => {
    it('filters by a selected muscle group chip, built dynamically from current exercises', async () => {
      const user = userEvent.setup()
      seedExercises()
      render(<ExerciseList />)

      await user.click(screen.getByRole('button', { name: 'Legs' }))

      expect(screen.getByText('Squats')).toBeTruthy()
      expect(screen.queryByText('Push-ups')).toBeNull()
      expect(screen.queryByText('Pull-ups')).toBeNull()
    })

    it('"All" shows every exercise again', async () => {
      const user = userEvent.setup()
      seedExercises()
      render(<ExerciseList />)

      await user.click(screen.getByRole('button', { name: 'Legs' }))
      await user.click(screen.getByRole('button', { name: 'All' }))

      expect(screen.getByText('Push-ups')).toBeTruthy()
      expect(screen.getByText('Pull-ups')).toBeTruthy()
      expect(screen.getByText('Squats')).toBeTruthy()
    })

    it('composes with search using AND logic', async () => {
      const user = userEvent.setup()
      seedExercises([
        PUSH_UPS,
        PULL_UPS,
        SQUATS,
        createMockExercise({ id: 'ex-4', name: 'Leg Press', targetMuscleGroups: ['Legs'] }),
      ])
      render(<ExerciseList />)

      await user.click(screen.getByRole('button', { name: 'Legs' }))
      await user.type(screen.getByLabelText(/search exercises/i), 'squ')

      expect(screen.getByText('Squats')).toBeTruthy()
      expect(screen.queryByText('Leg Press')).toBeNull()
    })
  })

  describe('undo-able delete', () => {
    beforeEach(() => {
      // shouldAdvanceTime lets React's own scheduling (and sonner's rAF-driven toast
      // animations) keep making real-time progress while vi.advanceTimersByTime still
      // deterministically fast-forwards our own undo-window setTimeout.
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
      // sonner keeps toasts in a module-level store independent of any mounted Toaster,
      // so a toast queued by one test would otherwise still be showing in the next.
      toast.dismiss()
    })

    it('hides the exercise immediately, commits only after the undo window elapses', async () => {
      // No Toaster mounted here — this test never interacts with the toast UI.
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      seedExercises()
      render(<ExerciseList />)

      const card = screen.getByText('Squats').closest<HTMLElement>('.card-pad')!
      await user.click(within(card).getByRole('button', { name: /delete/i }))

      // Hidden immediately, before the undo window elapses.
      expect(screen.queryByText('Squats')).toBeNull()
      expect(mockedStorage.deleteExercise).not.toHaveBeenCalled()

      // The commit fires synchronously off our own setTimeout callback, so it's already
      // reflected in the mock the instant advanceTimersByTime returns — no waitFor needed.
      vi.advanceTimersByTime(5000)
      expect(mockedStorage.deleteExercise).toHaveBeenCalledWith('ex-3')
    })

    it('Undo cancels the pending deletion and restores the exercise', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      seedExercises()
      renderExerciseList()

      const card = screen.getByText('Squats').closest<HTMLElement>('.card-pad')!
      await user.click(within(card).getByRole('button', { name: /delete/i }))
      expect(screen.queryByText('Squats')).toBeNull()

      const undoButton = await screen.findByRole('button', { name: /undo/i })
      await user.click(undoButton)

      expect(screen.getByText('Squats')).toBeTruthy()

      vi.advanceTimersByTime(5000)
      expect(mockedStorage.deleteExercise).not.toHaveBeenCalled()
    })
  })
})
