/**
 * End-to-end tests for the RoutineBuilder plan-builder overlay: expanding a day's
 * picker, adding/removing exercises via the toggle-grid and chip, and the close action.
 * Multi-routine management (create/rename/delete/switch) lives in ProfileScreen now, not
 * here — see ProfileScreen.e2e.test.tsx for that coverage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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

describe('E2E: Routine Builder (plan builder overlay)', () => {
  beforeEach(() => {
    useExercisesStore.setState(INITIAL_EXERCISES, true)
    useRoutineStore.setState(INITIAL_ROUTINE, true)
    useWorkoutSessionsStore.setState(INITIAL_SESSIONS, true)
    useWorkoutSessionsStore.getState().invalidateCache()
  })

  it('renders all seven days, each starting as a rest day', () => {
    render(<RoutineBuilder onClose={() => {}} />)

    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
      expect(screen.getByText(day)).toBeTruthy()
    }
    expect(screen.getAllByText('Rest day')).toHaveLength(7)
  })

  it('expanding a day shows a toggle-grid of the exercise library', async () => {
    const user = userEvent.setup()
    await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])
    render(<RoutineBuilder onClose={() => {}} />)

    const mondayCard = screen.getByText('Monday').closest('.card') as HTMLElement
    await user.click(within(mondayCard).getByRole('button', { name: /add/i }))

    expect(within(mondayCard).getByRole('button', { name: 'Bench Press' })).toBeTruthy()
  })

  it('adds an exercise via the toggle-grid and shows it as a removable chip', async () => {
    const user = userEvent.setup()
    await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])
    render(<RoutineBuilder onClose={() => {}} />)

    const mondayCard = screen.getByText('Monday').closest('.card') as HTMLElement
    await user.click(within(mondayCard).getByRole('button', { name: /add/i }))
    await user.click(within(mondayCard).getByRole('button', { name: 'Bench Press' }))

    await waitFor(() => {
      // Chip + grid toggle button both now read "Bench Press" — two matches.
      expect(within(mondayCard).getAllByText('Bench Press')).toHaveLength(2)
    })
    expect(within(mondayCard).queryByText('Rest day')).toBeNull()
  })

  it('removes an exercise by clicking the chip\'s remove button', async () => {
    const user = userEvent.setup()
    await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])
    render(<RoutineBuilder onClose={() => {}} />)

    const mondayCard = screen.getByText('Monday').closest('.card') as HTMLElement
    await user.click(within(mondayCard).getByRole('button', { name: /add/i }))
    await user.click(within(mondayCard).getByRole('button', { name: 'Bench Press' }))
    await waitFor(() => expect(within(mondayCard).queryByText('Rest day')).toBeNull())

    await user.click(within(mondayCard).getByRole('button', { name: /remove bench press/i }))

    await waitFor(() => {
      expect(within(mondayCard).getByText('Rest day')).toBeTruthy()
    })
  })

  it('keeps assignments independent per day', async () => {
    const user = userEvent.setup()
    await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])
    render(<RoutineBuilder onClose={() => {}} />)

    const mondayCard = screen.getByText('Monday').closest('.card') as HTMLElement
    await user.click(within(mondayCard).getByRole('button', { name: /add/i }))
    await user.click(within(mondayCard).getByRole('button', { name: 'Bench Press' }))
    await waitFor(() => expect(within(mondayCard).queryByText('Rest day')).toBeNull())

    const wednesdayCard = screen.getByText('Wednesday').closest('.card') as HTMLElement
    expect(within(wednesdayCard).getByText('Rest day')).toBeTruthy()
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<RoutineBuilder onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
