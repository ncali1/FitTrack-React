/**
 * End-to-end tests for the guided-session helpers used mid-set: the warm-up ramp under the
 * weight field, and swapping the current exercise for a same-muscle alternative.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DailyChecklist } from './DailyChecklist'
import { useExercisesStore } from '@/stores/exercises'
import { useRoutineStore } from '@/stores/routine'
import { useWorkoutTemplatesStore } from '@/stores/workoutTemplates'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useSettingsStore } from '@/stores/settings'
import { getDayOfWeek } from '@/utils/calculations'
import type { Exercise, Routine, WorkoutTemplate, WorkoutSession } from '@/types'

/** A tiny in-memory stand-in for IndexedDB, since DailyChecklist reloads its stores on mount. */
const db = vi.hoisted(() => ({
  exercises: [] as unknown[],
  routines: [] as unknown[],
  templates: [] as unknown[],
  sessions: [] as unknown[],
}))

vi.mock('@/services/storage', () => {
  const put = (table: unknown[], record: { id: string }) => {
    const index = (table as { id: string }[]).findIndex((r) => r.id === record.id)
    if (index >= 0) table[index] = record
    else table.push(record)
  }
  return {
    storageService: {
      saveExercise: vi.fn(async (e: Exercise) => put(db.exercises, e)),
      getAllExercises: vi.fn(async () => [...db.exercises]),
      saveRoutine: vi.fn(async (r: Routine) => put(db.routines, r)),
      getAllRoutines: vi.fn(async () => [...db.routines]),
      saveWorkoutTemplate: vi.fn(async (t: WorkoutTemplate) => put(db.templates, t)),
      getAllWorkoutTemplates: vi.fn(async () => [...db.templates]),
      saveCardioSession: vi.fn(async () => {}),
      getAllCardioSessions: vi.fn(async () => []),
      deleteCardioSession: vi.fn(async () => {}),
      saveWorkoutSession: vi.fn(async (s: WorkoutSession) => put(db.sessions, s)),
      getAllWorkoutSessions: vi.fn(async () => [...db.sessions]),
    },
  }
})

const INITIAL_EXERCISES = useExercisesStore.getState()
const INITIAL_ROUTINE = useRoutineStore.getState()
const INITIAL_TEMPLATES = useWorkoutTemplatesStore.getState()
const INITIAL_SESSIONS = useWorkoutSessionsStore.getState()
const INITIAL_SETTINGS = useSettingsStore.getState()

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const today = todayString()

async function startGuidedSession(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Start guided workout' }))
  await user.click(screen.getByRole('button', { name: 'Start session' }))
  await screen.findByText('Log Performance')
}

describe('E2E: guided session warm-ups and swaps', () => {
  let bench: Exercise

  beforeEach(async () => {
    db.exercises.length = db.routines.length = db.templates.length = db.sessions.length = 0
    useExercisesStore.setState(INITIAL_EXERCISES, true)
    useRoutineStore.setState(INITIAL_ROUTINE, true)
    useWorkoutTemplatesStore.setState(INITIAL_TEMPLATES, true)
    useWorkoutSessionsStore.setState(INITIAL_SESSIONS, true)
    useSettingsStore.setState({ ...INITIAL_SETTINGS, weightUnit: 'kg' }, true)

    bench = await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])
    await useRoutineStore.getState().assignExercise(getDayOfWeek(today), bench.id)
  })

  it('shows a warm-up ramp with plate loading for the entered working weight', async () => {
    const user = userEvent.setup()
    render(<DailyChecklist />)
    await startGuidedSession(user)

    expect(screen.queryByRole('button', { name: 'Show warm-up sets' })).toBeNull()

    await user.type(screen.getByLabelText(/Weight \(kg\)/), '100')
    await user.click(screen.getByRole('button', { name: 'Show warm-up sets' }))

    const ramp = within(screen.getByRole('list', { name: 'Warm-up sets' }))
    const rows = ramp.getAllByRole('listitem').map((li) => li.textContent)
    expect(rows).toEqual([
      expect.stringContaining('20kg × 10'),
      expect.stringContaining('40kg × 5'),
      expect.stringContaining('60kg × 3'),
      expect.stringContaining('80kg × 2'),
    ])
    expect(rows[3]).toContain('20kg bar + 25, 5 per side')

    await user.click(screen.getByRole('button', { name: 'Hide warm-up sets' }))
    expect(screen.queryByRole('list', { name: 'Warm-up sets' })).toBeNull()
  })

  it('hides the warm-up ramp while logging a warm-up set itself', async () => {
    const user = userEvent.setup()
    render(<DailyChecklist />)
    await startGuidedSession(user)

    await user.type(screen.getByLabelText(/Weight \(kg\)/), '100')
    expect(screen.getByRole('button', { name: 'Show warm-up sets' })).toBeTruthy()

    await user.click(screen.getByRole('checkbox', { name: /Warm-up set/ }))
    expect(screen.queryByRole('button', { name: 'Show warm-up sets' })).toBeNull()
  })

  it('swaps to a library alternative, logs it, and rewrites the day’s plan to match', async () => {
    const user = userEvent.setup()
    render(<DailyChecklist />)
    await startGuidedSession(user)

    await user.click(screen.getByRole('button', { name: 'Swap exercise' }))
    const sheet = within(screen.getByRole('dialog', { name: 'Swap Bench Press' }))
    expect(sheet.queryByRole('button', { name: 'Swap to Bench Press' })).toBeNull()
    expect(sheet.queryByRole('button', { name: /Barbell Squat/ })).toBeNull()

    await user.click(sheet.getByRole('button', { name: 'Swap to Barbell Bench Press' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText(/Barbell Bench Press/)).toBeTruthy()

    const swappedIn = useExercisesStore.getState().exercises.find((e) => e.name === 'Barbell Bench Press')!
    expect(swappedIn).toBeTruthy()
    expect(useWorkoutSessionsStore.getState().sessions.find((s) => s.date === today)?.plannedExerciseIds).toEqual([
      swappedIn.id,
    ])

    await user.type(screen.getByLabelText('Actual Sets *'), '3')
    await user.type(screen.getByLabelText('Actual Reps *'), '8')
    await user.click(screen.getByText('Moderate'))
    await user.click(screen.getByRole('button', { name: 'Finish workout' }))

    expect(await screen.findByText('Workout complete')).toBeTruthy()
    const session = useWorkoutSessionsStore.getState().sessions.find((s) => s.date === today)!
    expect(session.exercises.map((p) => p.exerciseId)).toEqual([swappedIn.id])
    // The weekly program itself is untouched — the swap only applies to today.
    expect(useRoutineStore.getState().routineForDay(getDayOfWeek(today))).toEqual([bench.id])
  })

  it('closes the swap sheet without changing anything', async () => {
    const user = userEvent.setup()
    render(<DailyChecklist />)
    await startGuidedSession(user)

    await user.click(screen.getByRole('button', { name: 'Swap exercise' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(/Bench Press/)).toBeTruthy()
    expect(useWorkoutSessionsStore.getState().sessions.find((s) => s.date === today)?.plannedExerciseIds).toBeUndefined()
  })
})
