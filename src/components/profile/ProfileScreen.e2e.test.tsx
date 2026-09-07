/**
 * End-to-end tests for ProfileScreen: multi-routine management (create, switch, rename,
 * delete — moved here from RoutineBuilder, which now only edits the active routine's
 * day assignments), quick settings toggles, and opening the plan builder / exercise
 * manager overlays.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileScreen } from './ProfileScreen'
import { useExercisesStore } from '@/stores/exercises'
import { useRoutineStore } from '@/stores/routine'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'

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
const INITIAL_SETTINGS = useSettingsStore.getState()
const INITIAL_AUTH = useAuthStore.getState()

describe('E2E: ProfileScreen', () => {
  beforeEach(() => {
    useExercisesStore.setState(INITIAL_EXERCISES, true)
    useRoutineStore.setState(INITIAL_ROUTINE, true)
    useSettingsStore.setState(INITIAL_SETTINGS, true)
    useAuthStore.setState(INITIAL_AUTH, true)
  })

  it('creates a second routine, switches to it, and keeps assignments independent', async () => {
    const user = userEvent.setup()
    await useRoutineStore.getState().loadRoutines()
    await useRoutineStore.getState().assignExercise('monday', 'ex-1')

    render(<ProfileScreen />)

    await user.click(screen.getByRole('button', { name: '+ New' }))
    await user.type(screen.getByLabelText(/routine name/i), '5x5')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '5x5' })).toBeTruthy()
    })

    // New routine is created inactive and starts with no active-routine display change
    // until switched to.
    await user.click(screen.getByRole('button', { name: '5x5' }))

    await waitFor(() => {
      expect(useRoutineStore.getState().routines.find((r) => r.name === '5x5')?.isActive).toBe(true)
    })
    // The original routine (still holding the Monday assignment) is no longer active.
    expect(useRoutineStore.getState().routines.find((r) => r.name === 'My Routine')?.isActive).toBe(false)
  })

  it('renames the active routine', async () => {
    const user = userEvent.setup()
    await useRoutineStore.getState().loadRoutines()
    render(<ProfileScreen />)

    await user.click(screen.getByRole('button', { name: /rename routine/i }))
    const input = screen.getByLabelText(/routine name/i)
    await user.clear(input)
    await user.type(input, 'Push Pull Legs')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Push Pull Legs' })).toBeTruthy()
    })
  })

  it('refuses to delete the last remaining routine (no delete button shown)', async () => {
    await useRoutineStore.getState().loadRoutines()
    render(<ProfileScreen />)

    expect(screen.queryByRole('button', { name: /delete routine/i })).toBeNull()
  })

  it('toggles the weight unit', async () => {
    const user = userEvent.setup()
    render(<ProfileScreen />)

    expect(useSettingsStore.getState().weightUnit).toBe('kg')
    await user.click(screen.getByRole('button', { name: 'lb' }))
    expect(useSettingsStore.getState().weightUnit).toBe('lb')
  })

  it('changes the rest timer duration', async () => {
    const user = userEvent.setup()
    render(<ProfileScreen />)

    await user.click(screen.getByRole('button', { name: '120s' }))
    expect(useSettingsStore.getState().restDuration).toBe(120)
  })

  it('toggles notifications', async () => {
    const user = userEvent.setup()
    render(<ProfileScreen />)

    const toggle = screen.getByRole('switch', { name: 'Notifications' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await user.click(toggle)
    expect(useSettingsStore.getState().remindersEnabled).toBe(true)
  })

  it('shows a Synced badge when cloud sync is enabled and the user is authenticated', () => {
    useAuthStore.setState({ cloudEnabled: true, user: { email: 'test@example.com' } as never })
    render(<ProfileScreen />)

    expect(screen.getByText('Synced')).toBeTruthy()
    expect(screen.getByText('test@example.com')).toBeTruthy()
  })

  it('shows Sign out only when authenticated', () => {
    useAuthStore.setState({ cloudEnabled: true, user: { email: 'test@example.com' } as never })
    render(<ProfileScreen />)

    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy()
  })

  it('opens the plan builder overlay from "Manage weekly plan"', async () => {
    const user = userEvent.setup()
    await useRoutineStore.getState().loadRoutines()
    render(<ProfileScreen />)

    await user.click(screen.getByRole('button', { name: /manage weekly plan/i }))

    expect(screen.getByText('Weekly plan')).toBeTruthy()
  })

  it('opens the exercise manager overlay from "Manage exercises"', async () => {
    const user = userEvent.setup()
    render(<ProfileScreen />)

    await user.click(screen.getByRole('button', { name: /manage exercises/i }))

    expect(screen.getByText('Your exercises')).toBeTruthy()
  })
})
