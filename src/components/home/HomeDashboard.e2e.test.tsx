/**
 * Home tab: today's plan is listed with each exercise's target sets×reps, a rest day says
 * so, and "Start workout" takes the user to Train.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HomeDashboard } from './HomeDashboard'
import { useExercisesStore } from '@/stores/exercises'
import { useRoutineStore } from '@/stores/routine'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useBodyWeightStore } from '@/stores/bodyWeight'
import { useUIStore } from '@/stores/ui'
import { createMockExercise, createMockRoutine } from '@/tests/factories'

vi.mock('@/services/storage', () => ({ storageService: {} }))

const INITIAL_EXERCISES = useExercisesStore.getState()
const INITIAL_ROUTINE = useRoutineStore.getState()
const INITIAL_SESSIONS = useWorkoutSessionsStore.getState()
const INITIAL_BODY_WEIGHT = useBodyWeightStore.getState()
const INITIAL_UI = useUIStore.getState()

// A Friday, so the plan below is for `friday`.
const FIXED_NOW = new Date(2026, 10, 6, 9, 0, 0)

describe('HomeDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)
    useExercisesStore.setState(INITIAL_EXERCISES, true)
    useRoutineStore.setState(INITIAL_ROUTINE, true)
    useWorkoutSessionsStore.setState(INITIAL_SESSIONS, true)
    useBodyWeightStore.setState(INITIAL_BODY_WEIGHT, true)
    useUIStore.setState(INITIAL_UI, true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists today’s exercises with their targets and opens Train on start', async () => {
    const bench = createMockExercise({ name: 'Bench Press', targetSets: 4, targetReps: 8 })
    const ohp = createMockExercise({ name: 'Overhead Press', targetSets: 3, targetReps: 10 })
    useExercisesStore.setState({ exercises: [bench, ohp] })
    const program = createMockRoutine()
    program.weeklyAssignments.friday = [bench.id, ohp.id]
    useRoutineStore.setState({ routines: [program] })

    render(<HomeDashboard />)

    expect(screen.getByRole('heading', { name: "Today's training" })).toBeInTheDocument()
    expect(screen.getByText('Wk 45')).toBeInTheDocument()
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]!).getByText('Bench Press')).toBeInTheDocument()
    expect(within(items[0]!).getByText('4×8')).toBeInTheDocument()
    expect(within(items[1]!).getByText('3×10')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /start workout/i }))
    expect(useUIStore.getState().activeTab).toBe('train')
  })

  it('shows a rest day when nothing is planned', () => {
    useRoutineStore.setState({ routines: [createMockRoutine()] })

    render(<HomeDashboard />)

    expect(screen.getByRole('heading', { name: 'Rest day' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start workout/i })).toBeNull()
  })
})
