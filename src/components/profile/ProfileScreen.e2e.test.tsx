/**
 * End-to-end tests for ProfileScreen: program management (create, switch, rename,
 * duplicate, delete), routine management (create, edit, duplicate, delete), preference
 * toggles, the data & account section, and opening the plan builder overlay.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileScreen } from './ProfileScreen'
import { useExercisesStore } from '@/stores/exercises'
import { useRoutineStore } from '@/stores/routine'
import { useWorkoutTemplatesStore } from '@/stores/workoutTemplates'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { storageService } from '@/services/storage'
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
    saveWorkoutTemplate: vi.fn(async () => {}),
    getAllWorkoutTemplates: vi.fn(async () => []),
    saveCardioSession: vi.fn(async () => {}),
    getAllCardioSessions: vi.fn(async () => []),
    deleteCardioSession: vi.fn(async () => {}),
    deleteWorkoutTemplate: vi.fn(async () => {}),
    saveWorkoutSession: vi.fn(async () => {}),
    getWorkoutSession: vi.fn(async () => undefined),
    getWorkoutSessionByDate: vi.fn(async () => undefined),
    getAllWorkoutSessions: vi.fn(async () => []),
    deleteWorkoutSession: vi.fn(async () => {}),
    getAllBodyWeightLogs: vi.fn(async () => []),
    clearAllData: vi.fn(async () => {}),
  },
}))

const INITIAL_EXERCISES = useExercisesStore.getState()
const INITIAL_ROUTINE = useRoutineStore.getState()
const INITIAL_TEMPLATES = useWorkoutTemplatesStore.getState()
const INITIAL_SESSIONS = useWorkoutSessionsStore.getState()
const INITIAL_SETTINGS = useSettingsStore.getState()
const INITIAL_AUTH = useAuthStore.getState()

describe('E2E: ProfileScreen', () => {
  beforeEach(() => {
    useExercisesStore.setState(INITIAL_EXERCISES, true)
    useRoutineStore.setState(INITIAL_ROUTINE, true)
    useWorkoutTemplatesStore.setState(INITIAL_TEMPLATES, true)
    useWorkoutSessionsStore.setState(INITIAL_SESSIONS, true)
    useSettingsStore.setState(INITIAL_SETTINGS, true)
    useAuthStore.setState(INITIAL_AUTH, true)
  })

  it('creates a second program, switches to it, and keeps assignments independent', async () => {
    const user = userEvent.setup()
    await useRoutineStore.getState().loadRoutines()
    await useRoutineStore.getState().assignExercise('monday', 'ex-1')

    render(<ProfileScreen />)

    await user.click(screen.getByRole('button', { name: '+ New program' }))
    await user.type(screen.getByLabelText(/program name/i), '5x5')
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
    expect(useRoutineStore.getState().routines.find((r) => r.name === 'My Program')?.isActive).toBe(false)
  })

  it('renames the active program', async () => {
    const user = userEvent.setup()
    await useRoutineStore.getState().loadRoutines()
    render(<ProfileScreen />)

    await user.click(screen.getByRole('button', { name: /rename program/i }))
    const input = screen.getByLabelText(/program name/i)
    await user.clear(input)
    await user.type(input, 'Push Pull Legs')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Push Pull Legs' })).toBeTruthy()
    })
  })

  it('refuses to delete the last remaining program (no delete button shown)', async () => {
    await useRoutineStore.getState().loadRoutines()
    render(<ProfileScreen />)

    expect(screen.queryByRole('button', { name: /delete program/i })).toBeNull()
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

    expect(screen.getByRole('button', { name: /^close$/i })).toBeTruthy()
    expect(screen.getByText('Monday')).toBeTruthy()
  })

  it('no longer offers exercise management, which lives in Library', () => {
    render(<ProfileScreen />)

    expect(screen.queryByRole('button', { name: /manage exercises/i })).toBeNull()
  })

  it('locks the page behind the routine editor while it is open', async () => {
    const user = userEvent.setup()
    await useWorkoutTemplatesStore.getState().createTemplate('Legs')
    render(<ProfileScreen />)

    expect(document.documentElement).not.toHaveClass('scroll-locked')
    await user.click(screen.getByRole('button', { name: 'Edit Legs' }))
    expect(document.documentElement).toHaveClass('scroll-locked')
    await user.click(screen.getByRole('button', { name: /^close$/i }))
    expect(document.documentElement).not.toHaveClass('scroll-locked')
  })

  it('duplicates the active program', async () => {
    const user = userEvent.setup()
    await useRoutineStore.getState().loadRoutines()
    render(<ProfileScreen />)

    await user.click(screen.getByRole('button', { name: /duplicate program/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'My Program copy' })).toBeTruthy()
    })
    expect(useRoutineStore.getState().activeRoutine()?.name).toBe('My Program')
  })

  describe('routines', () => {
    it('creates a routine, opens its editor, and adds and reorders exercises', async () => {
      const user = userEvent.setup()
      const { createExercise } = useExercisesStore.getState()
      await createExercise('Bench Press', 3, 10, ['Chest'])
      await createExercise('Overhead Press', 3, 8, ['Shoulders'])
      render(<ProfileScreen />)

      await user.click(screen.getByRole('button', { name: '+ New routine' }))
      await user.type(screen.getByLabelText(/routine name/i), 'Push Day')
      await user.click(screen.getByRole('button', { name: /^save$/i }))

      await waitFor(() => {
        expect(screen.getByText('Edit routine')).toBeTruthy()
      })

      await user.click(screen.getByRole('button', { name: 'Add Bench Press' }))
      await user.click(screen.getByRole('button', { name: 'Add Overhead Press' }))
      await waitFor(() => {
        expect(useWorkoutTemplatesStore.getState().templates[0]?.exerciseIds).toHaveLength(2)
      })

      await user.click(screen.getByRole('button', { name: 'Move Overhead Press up' }))

      const [bench, press] = useExercisesStore.getState().exercises
      await waitFor(() => {
        expect(useWorkoutTemplatesStore.getState().templates[0]?.exerciseIds).toEqual([press!.id, bench!.id])
      })
      expect(useWorkoutTemplatesStore.getState().templates[0]?.name).toBe('Push Day')
    })

    it('adds an exercise to a routine straight from the workout library, without duplicating one the user has', async () => {
      const user = userEvent.setup()
      // Same exercise as a library entry, under different capitalisation.
      await useExercisesStore.getState().createExercise('barbell bench press', 3, 10, ['Chest'])
      await useWorkoutTemplatesStore.getState().createTemplate('Push Day')
      render(<ProfileScreen />)

      await user.click(screen.getByRole('button', { name: 'Edit Push Day' }))

      // Already owned, so it is offered under the user's exercises, not as a library entry.
      expect(screen.queryByRole('button', { name: 'Add Barbell Bench Press from library' })).toBeNull()

      await user.type(screen.getByLabelText('Search workout library'), 'overhead')
      await user.click(screen.getByRole('button', { name: 'Add Overhead Press from library' }))

      await waitFor(() => {
        expect(useWorkoutTemplatesStore.getState().templates[0]?.exerciseIds).toHaveLength(1)
      })
      const press = useExercisesStore.getState().exercises.find((e) => e.name === 'Overhead Press')
      expect(press).toBeTruthy()
      expect(useWorkoutTemplatesStore.getState().templates[0]?.exerciseIds).toEqual([press!.id])
      expect(useExercisesStore.getState().exercises).toHaveLength(2)
    })

    it('lists each routine with its exercise count and the days it is scheduled on', async () => {
      await useRoutineStore.getState().loadRoutines()
      const template = await useWorkoutTemplatesStore.getState().createTemplate('Legs', ['a', 'b'])
      await useRoutineStore.getState().assignTemplate('monday', template.id)
      await useRoutineStore.getState().assignTemplate('thursday', template.id)
      render(<ProfileScreen />)

      expect(screen.getByText('2 exercises · Mon, Thu')).toBeTruthy()
    })

    it('duplicates a routine', async () => {
      const user = userEvent.setup()
      await useWorkoutTemplatesStore.getState().createTemplate('Legs', ['a'])
      render(<ProfileScreen />)

      await user.click(screen.getByRole('button', { name: 'Duplicate Legs' }))

      await waitFor(() => {
        expect(screen.getByText('Legs copy')).toBeTruthy()
      })
    })

    it('deletes a routine after confirmation, and keeps it when the confirmation is declined', async () => {
      const user = userEvent.setup()
      await useWorkoutTemplatesStore.getState().createTemplate('Legs', ['a'])
      render(<ProfileScreen />)

      const confirmSpy = vi.fn(() => false)
      vi.stubGlobal('confirm', confirmSpy)
      await user.click(screen.getByRole('button', { name: 'Delete Legs' }))
      expect(useWorkoutTemplatesStore.getState().templates).toHaveLength(1)

      confirmSpy.mockReturnValue(true)
      await user.click(screen.getByRole('button', { name: 'Delete Legs' }))
      await waitFor(() => {
        expect(useWorkoutTemplatesStore.getState().templates).toHaveLength(0)
      })
      vi.unstubAllGlobals()
    })
  })

  describe('workout preferences', () => {
    it('sets a custom rest time, and rejects one outside the allowed range', async () => {
      const user = userEvent.setup()
      render(<ProfileScreen />)

      await user.click(screen.getByRole('button', { name: /custom rest time/i }))
      const input = screen.getByLabelText(/rest time in seconds/i)
      await user.clear(input)
      await user.type(input, '2')
      await user.click(screen.getByRole('button', { name: /^set$/i }))
      expect(useSettingsStore.getState().restDuration).toBe(90)

      await user.clear(input)
      await user.type(input, '75')
      await user.click(screen.getByRole('button', { name: /^set$/i }))
      expect(useSettingsStore.getState().restDuration).toBe(75)
      expect(screen.getByRole('button', { name: /custom rest time/i })).toHaveTextContent('75s')
    })

    it('toggles rest timer sound, vibration, and keep-screen-awake', async () => {
      const user = userEvent.setup()
      render(<ProfileScreen />)

      await user.click(screen.getByRole('switch', { name: 'Rest timer sound' }))
      await user.click(screen.getByRole('switch', { name: 'Rest timer vibration' }))
      await user.click(screen.getByRole('switch', { name: 'Keep screen awake' }))

      expect(useSettingsStore.getState()).toMatchObject({
        restTimerSound: true,
        restTimerVibrate: false,
        keepScreenAwake: false,
      })
    })
  })

  describe('data & account', () => {
    it('shows lifetime stats from logged sessions', () => {
      useWorkoutSessionsStore.setState({
        sessions: [
          { id: 's1', date: '2025-01-01', exercises: [{ exerciseId: 'a', completed: true, weight: 50, actualReps: 8, timestamp: 1 }], createdAt: 1, updatedAt: 1 },
          { id: 's2', date: '2025-01-03', exercises: [{ exerciseId: 'a', completed: true, weight: 60, actualReps: 8, timestamp: 2 }], createdAt: 2, updatedAt: 2 },
          { id: 's3', date: '2025-01-05', exercises: [{ exerciseId: 'a', completed: false, timestamp: 3 }], createdAt: 3, updatedAt: 3 },
        ],
      })
      render(<ProfileScreen />)

      expect(within(screen.getByText('Workouts').parentElement!).getByText('2')).toBeTruthy()
      expect(within(screen.getByText('Records set').parentElement!).getByText('1')).toBeTruthy()
    })

    it('offers backup export/import and hides change password when signed out', () => {
      render(<ProfileScreen />)

      expect(screen.getByRole('button', { name: /export/i })).toBeTruthy()
      expect(screen.getByRole('button', { name: /import/i })).toBeTruthy()
      expect(screen.getByRole('link', { name: /privacy policy/i })).toBeTruthy()
      expect(screen.queryByRole('button', { name: /change password/i })).toBeNull()
    })

    it('shows change password when signed in', () => {
      useAuthStore.setState({ cloudEnabled: true, user: { email: 'test@example.com' } as never })
      render(<ProfileScreen />)

      expect(screen.getByRole('button', { name: /change password/i })).toBeTruthy()
    })

    it('deletes all data only after the second, explicit confirmation', async () => {
      const user = userEvent.setup()
      await useWorkoutTemplatesStore.getState().createTemplate('Legs', ['a'])
      render(<ProfileScreen />)

      await user.click(screen.getByRole('button', { name: /delete all my data/i }))
      expect(storageService.clearAllData).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(storageService.clearAllData).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: /delete all my data/i }))
      await user.click(screen.getByRole('button', { name: /yes, delete everything/i }))

      await waitFor(() => {
        expect(storageService.clearAllData).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(useWorkoutTemplatesStore.getState().templates).toEqual([])
      })
    })
  })
})
