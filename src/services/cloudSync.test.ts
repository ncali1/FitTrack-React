/**
 * Tests for the parts of cloud sync that have to cope with a Supabase project whose
 * schema hasn't been updated yet: upserts must still get the core data through, and a
 * pull must not wipe local fields the cloud has no column for.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Exercise, Routine, WorkoutSession, WorkoutTemplate } from '@/types'

type Row = Record<string, unknown>

/** What the fake Supabase should answer with, per table, set by each test. */
const cloud = vi.hoisted(() => ({
  upserts: [] as { table: string; row: Row }[],
  deletes: [] as string[],
  upsertError: (_table: string, _row: Row): { code: string } | null => null,
  rows: {} as Record<string, Row[] | null>,
}))

vi.mock('./supabaseClient', () => ({
  isCloudEnabled: () => true,
  getSupabase: () => ({
    from: (table: string) => ({
      upsert: async (row: Row) => {
        cloud.upserts.push({ table, row })
        return { error: cloud.upsertError(table, row) }
      },
      select: () => ({
        eq: async () => {
          const data = cloud.rows[table]
          return data === null ? { data: null, error: { code: 'PGRST205' } } : { data: data ?? [], error: null }
        },
      }),
      delete: () => ({
        eq: async () => {
          cloud.deletes.push(table)
          return { error: null }
        },
      }),
    }),
    auth: { getSession: async () => ({ data: { session: null } }) },
  }),
}))

const local = vi.hoisted(() => ({
  exercises: [] as unknown[],
  routines: [] as unknown[],
  sessions: [] as unknown[],
  saved: { exercises: [] as unknown[], routines: [] as unknown[], templates: [] as unknown[], sessions: [] as unknown[] },
}))

vi.mock('./storage', () => ({
  storageService: {
    getAllExercises: vi.fn(async () => local.exercises),
    getAllRoutines: vi.fn(async () => local.routines),
    getAllWorkoutSessions: vi.fn(async () => local.sessions),
    saveExercise: vi.fn(async (e: unknown) => void local.saved.exercises.push(e)),
    saveRoutine: vi.fn(async (r: unknown) => void local.saved.routines.push(r)),
    saveWorkoutTemplate: vi.fn(async (t: unknown) => void local.saved.templates.push(t)),
    saveWorkoutSession: vi.fn(async (s: unknown) => void local.saved.sessions.push(s)),
    saveBodyWeightLog: vi.fn(async () => {}),
  },
}))

import {
  syncUpsertRoutine,
  syncUpsertSession,
  syncUpsertWorkoutTemplate,
  flushQueue,
  pullAndHydrate,
  deleteAllCloudData,
} from './cloudSync'

const QUEUE_KEY = 'fittrack-sync-queue'
const queued = () => JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as { type: string }[]

const routine: Routine = {
  id: 'r1',
  name: 'PPL',
  isActive: true,
  weeklyAssignments: { monday: ['ex1'] },
  weeklyTemplates: { monday: ['t1'] },
  createdAt: 1,
  updatedAt: 2,
}

const session: WorkoutSession = {
  id: 's1',
  date: '2025-01-06',
  exercises: [{ exerciseId: 'ex1', completed: true, timestamp: 1 }],
  durationSeconds: 1800,
  plannedExerciseIds: ['ex1', 'ex2'],
  createdAt: 1,
  updatedAt: 2,
}

const template: WorkoutTemplate = { id: 't1', name: 'Push Day', exerciseIds: ['ex1'], createdAt: 1, updatedAt: 2 }

/** Rejects any row carrying a column from after the first schema release, as an un-migrated project would. */
const rejectNewColumns = (_table: string, row: Row) =>
  ['weekly_templates', 'planned_exercise_ids', 'duration_seconds', 'notes', 'rest_seconds'].some((c) => c in row)
    ? { code: 'PGRST204' }
    : null

describe('cloudSync', () => {
  beforeEach(() => {
    localStorage.clear()
    cloud.upserts = []
    cloud.deletes = []
    cloud.upsertError = () => null
    cloud.rows = {}
    local.exercises = []
    local.routines = []
    local.sessions = []
    local.saved = { exercises: [], routines: [], templates: [], sessions: [] }
  })

  describe('pushing to a migrated project', () => {
    it('sends template assignments and the planned-exercise override', async () => {
      await syncUpsertRoutine('u1', routine)
      await syncUpsertSession('u1', session)
      await syncUpsertWorkoutTemplate('u1', template)

      expect(cloud.upserts.map((u) => u.table)).toEqual(['routines', 'workout_sessions', 'workout_templates'])
      expect(cloud.upserts[0]!.row.weekly_templates).toEqual({ monday: ['t1'] })
      expect(cloud.upserts[1]!.row).toMatchObject({ planned_exercise_ids: ['ex1', 'ex2'], duration_seconds: 1800 })
      expect(cloud.upserts[2]!.row).toMatchObject({ user_id: 'u1', name: 'Push Day', exercise_ids: ['ex1'] })
      expect(queued()).toEqual([])
    })

    it('writes null to clear an override that was removed locally', async () => {
      await syncUpsertSession('u1', { ...session, plannedExerciseIds: undefined })

      expect(cloud.upserts[0]!.row.planned_exercise_ids).toBeNull()
    })
  })

  describe('pushing to a project that has not been migrated', () => {
    beforeEach(() => {
      cloud.upsertError = rejectNewColumns
    })

    it('retries a session without the new columns, so logged workouts still sync', async () => {
      await syncUpsertSession('u1', session)

      expect(cloud.upserts).toHaveLength(2)
      const retried = cloud.upserts[1]!.row
      expect(retried).toMatchObject({ id: 's1', date: '2025-01-06', exercises: session.exercises })
      expect(retried).not.toHaveProperty('planned_exercise_ids')
      expect(retried).not.toHaveProperty('duration_seconds')
      expect(queued()).toEqual([])
    })

    it('retries a routine without weekly_templates', async () => {
      await syncUpsertRoutine('u1', routine)

      expect(cloud.upserts[1]!.row).toMatchObject({ id: 'r1', weekly_assignments: { monday: ['ex1'] } })
      expect(cloud.upserts[1]!.row).not.toHaveProperty('weekly_templates')
      expect(queued()).toEqual([])
    })

    it('queues a template when its table is missing, and sends it once the table exists', async () => {
      cloud.upsertError = (table) => (table === 'workout_templates' ? { code: 'PGRST205' } : null)
      await syncUpsertWorkoutTemplate('u1', template)
      expect(queued().map((op) => op.type)).toEqual(['upsertWorkoutTemplate'])

      cloud.upsertError = () => null
      await flushQueue('u1')

      expect(queued()).toEqual([])
      expect(cloud.upserts.at(-1)).toMatchObject({ table: 'workout_templates', row: { id: 't1' } })
    })

    it('queues, rather than retrying, on any other failure', async () => {
      cloud.upsertError = () => ({ code: '500' })
      await syncUpsertSession('u1', session)

      expect(cloud.upserts).toHaveLength(1)
      expect(queued().map((op) => op.type)).toEqual(['upsertSession'])
    })
  })

  describe('pulling', () => {
    const baseRoutineRow = { id: 'r1', name: 'PPL', is_active: true, weekly_assignments: { monday: ['ex1'] }, created_at: 1, updated_at: 2 }
    const baseSessionRow = { id: 's1', date: '2025-01-06', exercises: session.exercises, created_at: 1, updated_at: 2 }
    const baseExerciseRow = { id: 'ex1', name: 'Bench', target_sets: 3, target_reps: 10, target_muscle_groups: [], created_at: 1, updated_at: 2 }

    it('reads the new columns from a migrated project', async () => {
      cloud.rows = {
        routines: [{ ...baseRoutineRow, weekly_templates: { monday: ['t1'] } }],
        workout_templates: [{ id: 't1', name: 'Push Day', exercise_ids: ['ex1'], created_at: 1, updated_at: 2 }],
        workout_sessions: [{ ...baseSessionRow, duration_seconds: 1800, planned_exercise_ids: ['ex1', 'ex2'] }],
        exercises: [{ ...baseExerciseRow, notes: 'elbows in', rest_seconds: 120 }],
      }

      await pullAndHydrate('u1')

      expect(local.saved.routines).toEqual([routine])
      expect(local.saved.templates).toEqual([template])
      expect(local.saved.sessions).toEqual([session])
      expect(local.saved.exercises[0]).toMatchObject({ notes: 'elbows in', restSeconds: 120 })
    })

    it('keeps local values for columns an un-migrated project does not have', async () => {
      const localExercise = { id: 'ex1', notes: 'elbows in', restSeconds: 120 } as Exercise
      local.exercises = [localExercise]
      local.routines = [routine]
      local.sessions = [session]
      cloud.rows = {
        routines: [baseRoutineRow],
        workout_templates: null,
        workout_sessions: [baseSessionRow],
        exercises: [baseExerciseRow],
      }

      await pullAndHydrate('u1')

      expect(local.saved.routines[0]).toMatchObject({ weeklyTemplates: { monday: ['t1'] } })
      expect(local.saved.sessions[0]).toMatchObject({ plannedExerciseIds: ['ex1', 'ex2'], durationSeconds: 1800 })
      expect(local.saved.exercises[0]).toMatchObject({ notes: 'elbows in', restSeconds: 120 })
      expect(local.saved.templates).toEqual([])
    })

    it('lets a migrated project clear a value that is still set locally', async () => {
      local.sessions = [session]
      cloud.rows = { workout_sessions: [{ ...baseSessionRow, duration_seconds: null, planned_exercise_ids: null }] }

      await pullAndHydrate('u1')

      expect(local.saved.sessions[0]).not.toHaveProperty('plannedExerciseIds')
      expect(local.saved.sessions[0]).not.toHaveProperty('durationSeconds')
    })
  })

  it('deleteAllCloudData clears every table and drops queued retries', async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([{ type: 'upsertSession', payload: session }]))

    await deleteAllCloudData('u1')

    expect([...cloud.deletes].sort()).toEqual(
      ['body_weight_logs', 'exercises', 'routines', 'workout_sessions', 'workout_templates'].sort()
    )
    expect(queued()).toEqual([])
  })
})
