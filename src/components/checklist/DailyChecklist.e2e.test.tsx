/**
 * End-to-end tests for doing a routine on a day it isn't scheduled for: picking one from
 * Train replaces (or adds to) that date's plan without touching the weekly program, and
 * the scheduled plan can be restored afterwards.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DailyChecklist } from './DailyChecklist'
import { useExercisesStore } from '@/stores/exercises'
import { useRoutineStore } from '@/stores/routine'
import { useWorkoutTemplatesStore } from '@/stores/workoutTemplates'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
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
      saveWorkoutSession: vi.fn(async (s: WorkoutSession) => put(db.sessions, s)),
      getAllWorkoutSessions: vi.fn(async () => [...db.sessions]),
    },
  }
})

const INITIAL_EXERCISES = useExercisesStore.getState()
const INITIAL_ROUTINE = useRoutineStore.getState()
const INITIAL_TEMPLATES = useWorkoutTemplatesStore.getState()
const INITIAL_SESSIONS = useWorkoutSessionsStore.getState()

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const today = todayString()
const todayWeekday = getDayOfWeek(today)

describe('E2E: doing a different routine from Train', () => {
  let squat: Exercise
  let bench: Exercise
  let press: Exercise

  beforeEach(async () => {
    db.exercises.length = db.routines.length = db.templates.length = db.sessions.length = 0
    useExercisesStore.setState(INITIAL_EXERCISES, true)
    useRoutineStore.setState(INITIAL_ROUTINE, true)
    useWorkoutTemplatesStore.setState(INITIAL_TEMPLATES, true)
    useWorkoutSessionsStore.setState(INITIAL_SESSIONS, true)

    const { createExercise } = useExercisesStore.getState()
    squat = await createExercise('Squat', 3, 5, ['Legs'])
    bench = await createExercise('Bench Press', 3, 10, ['Chest'])
    press = await createExercise('Overhead Press', 3, 8, ['Shoulders'])
    await useWorkoutTemplatesStore.getState().createTemplate('Push Day', [bench.id, press.id])
  })

  it('on a rest day, loads the chosen routine into the checklist', async () => {
    const user = userEvent.setup()
    render(<DailyChecklist />)

    expect(await screen.findByText('Rest day')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Do a routine' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Do Push Day' }))

    expect(await screen.findByText('Bench Press')).toBeTruthy()
    expect(screen.getByText('Overhead Press')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('replaces a scheduled day without changing the weekly program, and can be undone', async () => {
    const user = userEvent.setup()
    await useRoutineStore.getState().assignExercise(todayWeekday, squat.id)
    render(<DailyChecklist />)

    expect(await screen.findByText('Squat')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Do a different routine' }))
    await user.click(screen.getByRole('button', { name: 'Replace this day with Push Day' }))

    expect(await screen.findByText('Bench Press')).toBeTruthy()
    expect(screen.queryByText('Squat')).toBeNull()
    expect(useRoutineStore.getState().routineForDay(todayWeekday)).toEqual([squat.id])

    await user.click(screen.getByRole('button', { name: 'Back to the scheduled plan' }))

    expect(await screen.findByText('Squat')).toBeTruthy()
    expect(screen.queryByText('Bench Press')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Back to the scheduled plan' })).toBeNull()
  })

  it('adds a routine on top of what is already scheduled', async () => {
    const user = userEvent.setup()
    await useRoutineStore.getState().assignExercise(todayWeekday, squat.id)
    render(<DailyChecklist />)

    await screen.findByText('Squat')
    await user.click(screen.getByRole('button', { name: 'Do a different routine' }))
    await user.click(screen.getByRole('button', { name: 'Add Push Day to this day' }))

    await waitFor(() => {
      expect(useWorkoutSessionsStore.getState().sessionByDate(today)?.plannedExerciseIds).toEqual([
        squat.id,
        bench.id,
        press.id,
      ])
    })
    expect(screen.getByText('Squat')).toBeTruthy()
    expect(screen.getByText('Overhead Press')).toBeTruthy()
  })

  it('shows a routine assigned to the weekday through the weekly plan', async () => {
    const [template] = useWorkoutTemplatesStore.getState().templates
    await useRoutineStore.getState().loadRoutines()
    await useRoutineStore.getState().assignTemplate(todayWeekday, template!.id)
    render(<DailyChecklist />)

    expect(await screen.findByText('Bench Press')).toBeTruthy()
    expect(screen.getByText('Overhead Press')).toBeTruthy()
  })
})
