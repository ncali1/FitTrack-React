/**
 * End-to-end tests for the ExerciseManager component: the complete user workflow of
 * creating exercises through the real rendered form/list and verifying they appear.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseManager } from './ExerciseManager'
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

const INITIAL_STATE = useExercisesStore.getState()

/** Waits for the initial load to finish — "Add Exercise" only renders once loading completes. */
async function waitForLoaded() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /add exercise/i })).toBeTruthy()
  })
}

/** Fills in and submits the ExerciseForm for a single exercise (already open when called). */
async function fillAndSubmitExerciseForm(
  user: ReturnType<typeof userEvent.setup>,
  exercise: { name: string; sets: number; reps: number; muscleGroups: string[] }
) {
  await user.type(screen.getByLabelText(/exercise name/i), exercise.name)

  const setsInput = screen.getByLabelText(/target sets/i)
  await user.clear(setsInput)
  await user.type(setsInput, String(exercise.sets))

  const repsInput = screen.getByLabelText(/target reps/i)
  await user.clear(repsInput)
  await user.type(repsInput, String(exercise.reps))

  for (const group of exercise.muscleGroups) {
    await user.click(screen.getByLabelText(group))
  }

  await user.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
  })
}

describe('ExerciseManager – create exercises workflow', () => {
  beforeEach(() => {
    useExercisesStore.setState(INITIAL_STATE, true)
  })

  it('shows an empty state message when no exercises exist', async () => {
    render(<ExerciseManager />)
    await waitForLoaded()

    expect(screen.getByText(/no exercises yet/i)).toBeTruthy()
  })

  it('creates a single exercise and shows it in the list', async () => {
    const user = userEvent.setup()
    render(<ExerciseManager />)
    await waitForLoaded()

    await user.click(screen.getByRole('button', { name: /add exercise/i }))
    await fillAndSubmitExerciseForm(user, { name: 'Push-ups', sets: 3, reps: 15, muscleGroups: ['Chest', 'Triceps'] })

    await waitFor(() => {
      expect(screen.getByText('Push-ups')).toBeTruthy()
    })
  })

  it('creates 3 different exercises with various muscle groups and all appear in the list', async () => {
    const user = userEvent.setup()
    const exercises = [
      { name: 'Push-ups', sets: 3, reps: 15, muscleGroups: ['Chest', 'Triceps'] },
      { name: 'Pull-ups', sets: 4, reps: 8, muscleGroups: ['Back', 'Biceps'] },
      { name: 'Squats', sets: 4, reps: 12, muscleGroups: ['Legs', 'Glutes'] },
    ]

    render(<ExerciseManager />)
    await waitForLoaded()

    for (const exercise of exercises) {
      await user.click(screen.getByRole('button', { name: /add exercise/i }))
      await fillAndSubmitExerciseForm(user, exercise)
    }

    await waitFor(() => {
      expect(screen.getByText('Push-ups')).toBeTruthy()
      expect(screen.getByText('Pull-ups')).toBeTruthy()
      expect(screen.getByText('Squats')).toBeTruthy()
    })
  })

  it('shows muscle group information for each created exercise', async () => {
    const user = userEvent.setup()
    render(<ExerciseManager />)
    await waitForLoaded()

    await user.click(screen.getByRole('button', { name: /add exercise/i }))
    await fillAndSubmitExerciseForm(user, { name: 'Squats', sets: 4, reps: 12, muscleGroups: ['Legs', 'Glutes'] })

    // Scoped to the exercise card since "Legs"/"Glutes" also appear as muscle-group
    // filter chips above the list.
    await waitFor(() => {
      const card = within(screen.getByText('Squats').closest('.card-pad')!)
      expect(card.getByText('Legs')).toBeTruthy()
      expect(card.getByText('Glutes')).toBeTruthy()
    })
  })

  it('shows sets and reps for each created exercise', async () => {
    const user = userEvent.setup()
    render(<ExerciseManager />)
    await waitForLoaded()

    await user.click(screen.getByRole('button', { name: /add exercise/i }))
    await fillAndSubmitExerciseForm(user, { name: 'Squats', sets: 4, reps: 12, muscleGroups: ['Legs'] })

    await waitFor(() => {
      expect(screen.getByText(/Sets: 4/)).toBeTruthy()
      expect(screen.getByText(/Reps: 12/)).toBeTruthy()
    })
  })

  it('the exercise list grows with each new exercise added', async () => {
    const user = userEvent.setup()
    const exercisesToAdd = [
      { name: 'Push-ups', sets: 3, reps: 15, muscleGroups: ['Chest'] },
      { name: 'Pull-ups', sets: 4, reps: 8, muscleGroups: ['Back'] },
      { name: 'Squats', sets: 4, reps: 12, muscleGroups: ['Legs'] },
    ]

    render(<ExerciseManager />)
    await waitForLoaded()

    for (let i = 0; i < exercisesToAdd.length; i++) {
      await user.click(screen.getByRole('button', { name: /add exercise/i }))
      await fillAndSubmitExerciseForm(user, exercisesToAdd[i]!)

      for (let j = 0; j <= i; j++) {
        expect(screen.getByText(exercisesToAdd[j]!.name)).toBeTruthy()
      }
    }
  })
})
