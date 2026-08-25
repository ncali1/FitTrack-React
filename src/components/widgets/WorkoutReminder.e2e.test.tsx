/**
 * End-to-end tests for the WorkoutReminder component: the first-run opt-in ask, the
 * daily nudge once enabled, opting out, and the once-per-day cooldown.
 *
 * WorkoutReminder deliberately reads routines/sessions/remindersEnabled once at mount
 * (see the component's doc comment), so every scenario here sets up the routine
 * assignment *before* rendering, matching how it's actually used in the app (mounted
 * once App.tsx finishes loading data).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkoutReminder } from './WorkoutReminder'
import { useRoutineStore } from '@/stores/routine'
import { useSettingsStore } from '@/stores/settings'
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

const INITIAL_ROUTINE = useRoutineStore.getState()
const INITIAL_SETTINGS = useSettingsStore.getState()
const INITIAL_SESSIONS = useWorkoutSessionsStore.getState()

// A known Monday — matches the routine assignment used below.
const TODAY = new Date(2025, 0, 6)

beforeEach(() => {
  // Only fake Date — real timers stay intact so React's own scheduling still works.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TODAY)
  localStorage.clear()
  useRoutineStore.setState(INITIAL_ROUTINE, true)
  useSettingsStore.setState(INITIAL_SETTINGS, true)
  useWorkoutSessionsStore.setState(INITIAL_SESSIONS, true)
})

afterEach(() => {
  vi.useRealTimers()
})

/** Renders WorkoutReminder with a routine assigned for today (Monday). */
async function renderWithTodayAssigned() {
  await useRoutineStore.getState().assignExercise('monday', 'ex1')
  return render(<WorkoutReminder />)
}

describe('E2E: Workout Reminder', () => {
  it('shows nothing when reminders were explicitly disabled', async () => {
    useSettingsStore.getState().setRemindersEnabled(false)
    await useRoutineStore.getState().assignExercise('monday', 'ex1')

    render(<WorkoutReminder />)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByText(/you usually train today/i)).toBeNull()
  })

  it('shows an opt-in ask on the first qualifying day, and enabling switches to the nudge', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderWithTodayAssigned()

    expect(await screen.findByText(/want a nudge like this/i)).toBeTruthy()
    expect(useSettingsStore.getState().remindersEnabled).toBeNull()

    await user.click(screen.getByRole('button', { name: /enable/i }))

    expect(useSettingsStore.getState().remindersEnabled).toBe(true)
    await waitFor(() => {
      expect(screen.getByText(/nothing logged yet/i)).toBeTruthy()
    })
  })

  it('dismisses and remembers opt-out when "No thanks" is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderWithTodayAssigned()

    await screen.findByText(/want a nudge like this/i)
    await user.click(screen.getByRole('button', { name: /no thanks/i }))

    expect(useSettingsStore.getState().remindersEnabled).toBe(false)
    expect(screen.queryByText(/want a nudge like this/i)).toBeNull()
  })

  it('shows the nudge directly (no ask) once reminders are already enabled', async () => {
    useSettingsStore.getState().setRemindersEnabled(true)
    await useRoutineStore.getState().assignExercise('monday', 'ex1')

    render(<WorkoutReminder />)

    expect(await screen.findByText(/nothing logged yet/i)).toBeTruthy()
    expect(screen.queryByText(/want a nudge like this/i)).toBeNull()
  })

  it('does not show a second time the same day once already shown', async () => {
    useSettingsStore.getState().setRemindersEnabled(true)
    await useRoutineStore.getState().assignExercise('monday', 'ex1')

    const first = render(<WorkoutReminder />)
    await screen.findByText(/nothing logged yet/i)
    first.unmount()

    render(<WorkoutReminder />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByText(/nothing logged yet/i)).toBeNull()
  })
})
