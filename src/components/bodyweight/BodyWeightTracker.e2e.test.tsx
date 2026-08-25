/**
 * End-to-end test for the Body Weight tab: logging an entry, seeing it in the list,
 * and deleting it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BodyWeightTracker } from './BodyWeightTracker'
import { useBodyWeightStore } from '@/stores/bodyWeight'

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
    saveBodyWeightLog: vi.fn(async () => {}),
    getAllBodyWeightLogs: vi.fn(async () => []),
    deleteBodyWeightLog: vi.fn(async () => {}),
    clearAllData: vi.fn(async () => {}),
  },
}))

// Auto-confirm the delete prompt used by BodyWeightTracker's delete button.
vi.stubGlobal('confirm', () => true)

const INITIAL_STATE = useBodyWeightStore.getState()

describe('E2E: Body Weight Tracker', () => {
  beforeEach(() => {
    useBodyWeightStore.setState(INITIAL_STATE, true)
  })

  it('shows an empty state, logs an entry via the form, and lists it', async () => {
    const user = userEvent.setup()
    render(<BodyWeightTracker />)

    const weightInput = await screen.findByLabelText(/weight \(kg\)/i)
    expect(await screen.findByText(/no entries yet/i)).toBeTruthy()

    await user.type(weightInput, '80')
    // Submitting the form directly (rather than clicking the submit button) — happy-dom
    // doesn't reliably propagate a button click into the form's native submit event.
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByText(/80kg/)).toBeTruthy()
    })
    expect(screen.queryByText(/no entries yet/i)).toBeNull()
  })

  it('deletes a logged entry', async () => {
    const user = userEvent.setup()
    render(<BodyWeightTracker />)
    const weightInput = await screen.findByLabelText(/weight \(kg\)/i)

    await user.type(weightInput, '80')
    // Submitting the form directly (rather than clicking the submit button) — happy-dom
    // doesn't reliably propagate a button click into the form's native submit event.
    fireEvent.submit(document.querySelector('form')!)
    await waitFor(() => expect(screen.getByText(/80kg/)).toBeTruthy())

    await user.click(screen.getByRole('button', { name: /delete entry/i }))

    await waitFor(() => {
      expect(screen.getByText(/no entries yet/i)).toBeTruthy()
    })
  })
})
