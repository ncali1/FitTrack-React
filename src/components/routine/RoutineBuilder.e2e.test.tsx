/**
 * End-to-end tests for the RoutineBuilder component: the complete user workflow of
 * selecting a day, assigning/removing exercises via the real rendered UI, and managing
 * multiple routines. Store-level edge cases (case-insensitive days, duplicate guards,
 * etc.) are already covered by routine.test.ts — this file focuses on what only the
 * rendered UI can verify: that user interactions actually update what's on screen.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoutineBuilder } from './RoutineBuilder'
import { useExercisesStore } from '@/stores/exercises'
import { useRoutineStore } from '@/stores/routine'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'

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

const INITIAL_EXERCISES = useExercisesStore.getState()
const INITIAL_ROUTINE = useRoutineStore.getState()
const INITIAL_SESSIONS = useWorkoutSessionsStore.getState()

async function waitForLoaded() {
  await waitFor(() => {
    expect(screen.getByText('Weekly Routine')).toBeTruthy()
  })
}

describe('E2E: Routine Builder', () => {
  beforeEach(() => {
    useExercisesStore.setState(INITIAL_EXERCISES, true)
    useRoutineStore.setState(INITIAL_ROUTINE, true)
    useWorkoutSessionsStore.setState(INITIAL_SESSIONS, true)
    useWorkoutSessionsStore.getState().invalidateCache()
  })

  it('renders all seven days of the week, each starting empty', async () => {
    render(<RoutineBuilder />)
    await waitForLoaded()

    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
      expect(screen.getByText(day)).toBeTruthy()
    }
    expect(screen.getAllByText('No exercises assigned')).toHaveLength(7)
  })

  it('assigns an exercise to a day via the dropdown and reflects it in the grid', async () => {
    const user = userEvent.setup()
    await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])

    render(<RoutineBuilder />)
    await waitForLoaded()

    // Monday is selected by default
    await user.selectOptions(screen.getByLabelText(/available exercises/i), 'Bench Press (3x10)')

    await waitFor(() => {
      expect(screen.getByText('Selected Exercises')).toBeTruthy()
    })
    // Appears both in the "Selected Exercises" list and the weekly grid cell
    expect(screen.getAllByText('Bench Press')).toHaveLength(2)
  })

  it('removes an exercise from a day via the Remove button', async () => {
    const user = userEvent.setup()
    await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])

    render(<RoutineBuilder />)
    await waitForLoaded()

    await user.selectOptions(screen.getByLabelText(/available exercises/i), 'Bench Press (3x10)')
    await waitFor(() => expect(screen.getByText('Selected Exercises')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: /remove/i }))

    await waitFor(() => {
      expect(screen.getByText('No exercises selected yet')).toBeTruthy()
    })
    expect(screen.getAllByText('No exercises assigned')).toHaveLength(7)
  })

  it('switches which day is being edited when a different day is clicked', async () => {
    const user = userEvent.setup()
    await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])

    render(<RoutineBuilder />)
    await waitForLoaded()

    expect(screen.getByText(/add exercises to/i).textContent).toMatch(/monday/i)

    await user.click(screen.getByText('wednesday'))

    expect(screen.getByText(/add exercises to/i).textContent).toMatch(/wednesday/i)
  })

  it('creates a second routine, switches to it, and keeps assignments independent', async () => {
    const user = userEvent.setup()
    await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])

    render(<RoutineBuilder />)
    await waitForLoaded()

    // Assign Bench Press to Monday in the first (auto-created) routine
    await user.selectOptions(screen.getByLabelText(/available exercises/i), 'Bench Press (3x10)')
    await waitFor(() => expect(screen.getByText('Selected Exercises')).toBeTruthy())

    // Create a second routine
    await user.click(screen.getByRole('button', { name: /new routine/i }))
    await user.type(screen.getByLabelText(/routine name/i), '5x5')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText('5x5')).toBeTruthy()
    })

    // The new routine is created inactive — switch to it
    await user.click(screen.getByText('5x5'))

    await waitFor(() => {
      // Now active, Monday should be empty in this routine
      expect(screen.getByText('No exercises selected yet')).toBeTruthy()
    })

    // Switch back to the original routine — Bench Press should still be there
    await user.click(screen.getByText('My Routine'))
    await waitFor(() => {
      expect(screen.getByText('Selected Exercises')).toBeTruthy()
    })
  })
})
