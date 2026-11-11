/**
 * Tests for cloud sync against an in-memory stand-in for Supabase: the outbox (queueing,
 * compaction, flushing), deletes travelling between devices as tombstones, last-write-wins
 * pulls, and coping with a Supabase project whose schema hasn't been updated yet.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Exercise, Routine, WorkoutSession, WorkoutTemplate } from '@/types'

type Row = Record<string, unknown>
type Failure = { code: string } | null

/** The fake Supabase project: its tables, and the ways a test can make it misbehave. */
const cloud = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  /** Tables an un-migrated project doesn't have. */
  missing: new Set<string>(),
  offline: false,
  upserts: [] as { table: string; row: Row }[],
  upsertError: (_table: string, _row: Row): Failure => null,
  deleteError: (_table: string): Failure => null,
  /** Runs just before an upsert is applied, to simulate things happening mid-request. */
  onUpsert: (_table: string, _row: Row): void => {},
}))

vi.mock('./supabaseClient', () => {
  const unavailable = (table: string): Failure =>
    cloud.offline ? { code: 'NETWORK' } : cloud.missing.has(table) ? { code: 'PGRST205' } : null

  /** A chainable, awaitable query like supabase-js builds for select and delete. */
  const query = (table: string, kind: 'select' | 'delete', columns = '*') => {
    const filters: ((row: Row) => boolean)[] = []
    let orderBy = 'id'
    let window: [number, number] | null = null

    const run = () => {
      const error = unavailable(table) ?? (kind === 'delete' ? cloud.deleteError(table) : null)
      if (error) return { data: null, error }
      const rows = cloud.tables[table] ?? []
      const matching = rows.filter((row) => filters.every((matches) => matches(row)))
      if (kind === 'delete') {
        cloud.tables[table] = rows.filter((row) => !matching.includes(row))
        return { data: null, error: null }
      }
      const sorted = [...matching].sort((a, b) => String(a[orderBy]).localeCompare(String(b[orderBy])))
      const page = window ? sorted.slice(window[0], window[1] + 1) : sorted.slice(0, 1000)
      const picked = columns === '*' ? page : page.map((row) => Object.fromEntries(columns.split(',').map((c) => [c, row[c]])))
      return { data: picked, error: null }
    }

    const builder = {
      eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
      in: (column: string, values: unknown[]) => (filters.push((row) => values.includes(row[column])), builder),
      order: (column: string) => ((orderBy = column), builder),
      range: (from: number, to: number) => ((window = [from, to]), builder),
      then: <T>(resolve: (result: ReturnType<typeof run>) => T) => Promise.resolve(run()).then(resolve),
    }
    return builder
  }

  return {
    isCloudEnabled: () => true,
    getSupabase: () => ({
      from: (table: string) => ({
        upsert: async (input: Row | Row[], options?: { onConflict: string }) => {
          const rows = Array.isArray(input) ? input : [input]
          const key = (options?.onConflict ?? 'id').split(',')
          for (const row of rows) {
            cloud.upserts.push({ table, row })
            cloud.onUpsert(table, row)
            const error = unavailable(table) ?? cloud.upsertError(table, row)
            if (error) return { error }
          }
          const existing = cloud.tables[table] ?? []
          const replaced = existing.filter((old) => !rows.some((row) => key.every((k) => old[k] === row[k])))
          cloud.tables[table] = [...replaced, ...rows]
          return { error: null }
        },
        select: (columns: string) => query(table, 'select', columns),
        delete: () => query(table, 'delete'),
      }),
      auth: { getSession: async () => ({ data: { session: null } }) },
    }),
  }
})

type Stored = { id: string }

/** The fake IndexedDB: one id-keyed map per kind of record. */
const local = vi.hoisted(() => ({
  exercises: new Map<string, unknown>(),
  routines: new Map<string, unknown>(),
  templates: new Map<string, unknown>(),
  sessions: new Map<string, unknown>(),
  bodyWeight: new Map<string, unknown>(),
  cardio: new Map<string, unknown>(),
}))

vi.mock('./storage', () => {
  const crud = (map: () => Map<string, unknown>) => ({
    all: vi.fn(async () => [...map().values()]),
    save: vi.fn(async (record: Stored) => void map().set(record.id, record)),
    remove: vi.fn(async (id: string) => void map().delete(id)),
  })
  const exercises = crud(() => local.exercises)
  const routines = crud(() => local.routines)
  const templates = crud(() => local.templates)
  const sessions = crud(() => local.sessions)
  const bodyWeight = crud(() => local.bodyWeight)
  const cardio = crud(() => local.cardio)
  return {
    storageService: {
      getAllExercises: exercises.all,
      saveExercise: exercises.save,
      deleteExercise: exercises.remove,
      getAllRoutines: routines.all,
      saveRoutine: routines.save,
      deleteRoutine: routines.remove,
      getAllWorkoutTemplates: templates.all,
      saveWorkoutTemplate: templates.save,
      deleteWorkoutTemplate: templates.remove,
      getAllWorkoutSessions: sessions.all,
      saveWorkoutSession: sessions.save,
      deleteWorkoutSession: sessions.remove,
      getAllBodyWeightLogs: bodyWeight.all,
      saveBodyWeightLog: bodyWeight.save,
      deleteBodyWeightLog: bodyWeight.remove,
      getAllCardioSessions: cardio.all,
      saveCardioSession: cardio.save,
      deleteCardioSession: cardio.remove,
    },
  }
})

import {
  syncUpsertExercise,
  syncDeleteExercise,
  syncUpsertRoutine,
  syncUpsertSession,
  syncUpsertWorkoutTemplate,
  syncUpsertCardioSession,
  flushQueue,
  pullAndHydrate,
  syncWithCloud,
  markRestorePending,
  deleteAllCloudData,
} from './cloudSync'

const QUEUE_KEY = 'fittrack-sync-queue'
const queued = () =>
  JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as { kind: string; table: string; id: string; payload?: Row }[]

/** Puts rows straight into the fake project as if another device had uploaded them. */
const seed = (table: string, rows: Row[], userId = 'u1') => {
  cloud.tables[table] = [...(cloud.tables[table] ?? []), ...rows.map((row) => ({ user_id: userId, ...row }))]
}
const tombstone = (table: string, id: string, deletedAt: number) =>
  seed('deleted_records', [{ table_name: table, record_id: id, deleted_at: deletedAt }])
const cloudIds = (table: string) => (cloud.tables[table] ?? []).map((row) => row.id ?? row.record_id)

const exercise: Exercise = {
  id: 'ex1',
  name: 'Bench',
  targetSets: 3,
  targetReps: 10,
  targetMuscleGroups: [],
  createdAt: 1,
  updatedAt: 2,
}

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

const exerciseRow = { id: 'ex1', name: 'Bench', target_sets: 3, target_reps: 10, target_muscle_groups: [], created_at: 1, updated_at: 2 }
const routineRow = { id: 'r1', name: 'PPL', is_active: true, weekly_assignments: { monday: ['ex1'] }, created_at: 1, updated_at: 2 }
const sessionRow = { id: 's1', date: '2025-01-06', exercises: session.exercises, created_at: 1, updated_at: 2 }

/** Rejects any row carrying a column from after the first schema release, as an un-migrated project would. */
const rejectNewColumns = (_table: string, row: Row) =>
  ['weekly_templates', 'planned_exercise_ids', 'duration_seconds', 'notes', 'rest_seconds'].some((c) => c in row)
    ? { code: 'PGRST204' }
    : null

describe('cloudSync', () => {
  beforeEach(() => {
    localStorage.clear()
    cloud.tables = {}
    cloud.missing = new Set()
    cloud.offline = false
    cloud.upserts = []
    cloud.upsertError = () => null
    cloud.deleteError = () => null
    cloud.onUpsert = () => {}
    for (const map of Object.values(local)) map.clear()
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
      cloud.upsertError = () => null
      cloud.missing.add('workout_templates')
      await syncUpsertWorkoutTemplate('u1', template)
      expect(queued()).toMatchObject([{ kind: 'upsert', table: 'workout_templates', id: 't1' }])

      cloud.missing.clear()
      await flushQueue('u1')

      expect(queued()).toEqual([])
      expect(cloudIds('workout_templates')).toEqual(['t1'])
    })

    it('queues, rather than retrying, on any other failure', async () => {
      cloud.upsertError = () => ({ code: '500' })
      await syncUpsertSession('u1', session)

      expect(cloud.upserts).toHaveLength(1)
      expect(queued()).toMatchObject([{ kind: 'upsert', table: 'workout_sessions', id: 's1' }])
    })
  })

  describe('the outbox', () => {
    it('keeps only the latest snapshot of a record edited repeatedly while offline', async () => {
      cloud.offline = true
      await syncUpsertSession('u1', { ...session, updatedAt: 10 })
      await syncUpsertSession('u1', { ...session, updatedAt: 11 })
      await syncUpsertSession('u1', { ...session, updatedAt: 12 })

      expect(queued()).toHaveLength(1)
      expect(queued()[0]!.payload).toMatchObject({ updatedAt: 12 })
    })

    it('does not let an older queued snapshot overwrite a newer one that already synced', async () => {
      cloud.offline = true
      await syncUpsertSession('u1', { ...session, updatedAt: 10 })
      cloud.offline = false
      await syncUpsertSession('u1', { ...session, updatedAt: 11 })

      await flushQueue('u1')

      expect(queued()).toEqual([])
      expect(cloud.tables.workout_sessions).toMatchObject([{ id: 's1', updated_at: 11 }])
    })

    it('drops a queued upsert when the record is then deleted', async () => {
      cloud.offline = true
      await syncUpsertExercise('u1', exercise)
      await syncDeleteExercise('u1', 'ex1')

      expect(queued()).toMatchObject([{ kind: 'delete', table: 'exercises', id: 'ex1' }])
    })

    it('keeps a change that is queued while a flush is in flight', async () => {
      cloud.offline = true
      await syncUpsertSession('u1', session)
      cloud.offline = false

      // While the queued session is being sent, another change fails and gets queued.
      cloud.upsertError = (table) => (table === 'exercises' ? { code: '500' } : null)
      cloud.onUpsert = (table) => {
        if (table === 'workout_sessions') void syncUpsertExercise('u1', exercise)
      }
      await flushQueue('u1')

      expect(queued()).toMatchObject([{ kind: 'upsert', table: 'exercises', id: 'ex1' }])
      expect(cloudIds('workout_sessions')).toEqual(['s1'])
    })

    it("leaves another account's queued changes for that account", async () => {
      cloud.offline = true
      await syncUpsertSession('u1', session)
      cloud.offline = false

      await flushQueue('u2')
      expect(cloud.tables.workout_sessions).toBeUndefined()
      expect(queued()).toHaveLength(1)

      await flushQueue('u1')
      expect(cloud.tables.workout_sessions).toMatchObject([{ id: 's1', user_id: 'u1' }])
      expect(queued()).toEqual([])
    })

    it('still flushes retries queued by a version of the app from before the outbox changed shape', async () => {
      seed('exercises', [exerciseRow])
      localStorage.setItem(
        QUEUE_KEY,
        JSON.stringify([
          { type: 'upsertSession', payload: session },
          { type: 'deleteExercise', payload: { id: 'ex1' } },
        ])
      )

      await flushQueue('u1')

      expect(queued()).toEqual([])
      expect(cloudIds('workout_sessions')).toEqual(['s1'])
      expect(cloudIds('exercises')).toEqual([])
      expect(cloudIds('deleted_records')).toEqual(['ex1'])
    })
  })

  describe('deleting', () => {
    it('removes the row and leaves a tombstone for other devices', async () => {
      seed('exercises', [exerciseRow])

      await syncDeleteExercise('u1', 'ex1')

      expect(cloudIds('exercises')).toEqual([])
      expect(cloud.tables.deleted_records).toMatchObject([{ user_id: 'u1', table_name: 'exercises', record_id: 'ex1' }])
      expect(queued()).toEqual([])
    })

    it('still removes the row from a project that has no tombstone table yet', async () => {
      cloud.missing.add('deleted_records')
      seed('exercises', [exerciseRow])

      await syncDeleteExercise('u1', 'ex1')

      expect(cloudIds('exercises')).toEqual([])
      expect(queued()).toEqual([])
    })

    it('reaches a second device, which drops its copy on the next pull', async () => {
      local.exercises.set('ex1', exercise)
      tombstone('exercises', 'ex1', 5)

      expect(await pullAndHydrate('u1')).toBe(true)

      expect(local.exercises.size).toBe(0)
    })

    it('does not delete a record that was edited after the delete happened', async () => {
      local.exercises.set('ex1', { ...exercise, updatedAt: 9 })
      tombstone('exercises', 'ex1', 5)

      await pullAndHydrate('u1')

      expect(local.exercises.has('ex1')).toBe(true)
    })

    it('does not bring back a stale cloud row that a tombstone supersedes', async () => {
      seed('exercises', [exerciseRow])
      tombstone('exercises', 'ex1', 5)

      expect(await pullAndHydrate('u1')).toBe(false)

      expect(local.exercises.size).toBe(0)
    })

    it('does not bring back a record whose delete is still waiting in the outbox', async () => {
      seed('exercises', [exerciseRow])
      cloud.deleteError = () => ({ code: '500' })
      await syncDeleteExercise('u1', 'ex1')
      expect(queued()).toHaveLength(1)
      cloud.tables.deleted_records = []

      await pullAndHydrate('u1')

      expect(local.exercises.size).toBe(0)
    })

    it('never deletes a local record just because the cloud does not have it', async () => {
      local.exercises.set('ex1', exercise)

      expect(await pullAndHydrate('u1')).toBe(false)

      expect(local.exercises.has('ex1')).toBe(true)
      expect(cloud.upserts).toEqual([])
    })
  })

  describe('pulling', () => {
    it('reads the new columns from a migrated project', async () => {
      seed('routines', [{ ...routineRow, weekly_templates: { monday: ['t1'] } }])
      seed('workout_templates', [{ id: 't1', name: 'Push Day', exercise_ids: ['ex1'], created_at: 1, updated_at: 2 }])
      seed('workout_sessions', [{ ...sessionRow, duration_seconds: 1800, planned_exercise_ids: ['ex1', 'ex2'] }])
      seed('exercises', [{ ...exerciseRow, notes: 'elbows in', rest_seconds: 120 }])

      expect(await pullAndHydrate('u1')).toBe(true)

      expect([...local.routines.values()]).toEqual([routine])
      expect([...local.templates.values()]).toEqual([template])
      expect([...local.sessions.values()]).toEqual([session])
      expect(local.exercises.get('ex1')).toMatchObject({ notes: 'elbows in', restSeconds: 120 })
    })

    it('keeps local values for columns an un-migrated project does not have', async () => {
      local.exercises.set('ex1', { ...exercise, notes: 'elbows in', restSeconds: 120 })
      local.routines.set('r1', routine)
      local.sessions.set('s1', session)
      cloud.missing.add('workout_templates')
      seed('routines', [{ ...routineRow, name: 'PPL v2', updated_at: 3 }])
      seed('workout_sessions', [{ ...sessionRow, updated_at: 3 }])
      seed('exercises', [{ ...exerciseRow, name: 'Bench Press', updated_at: 3 }])

      await pullAndHydrate('u1')

      expect(local.routines.get('r1')).toMatchObject({ name: 'PPL v2', weeklyTemplates: { monday: ['t1'] } })
      expect(local.sessions.get('s1')).toMatchObject({ plannedExerciseIds: ['ex1', 'ex2'], durationSeconds: 1800 })
      expect(local.exercises.get('ex1')).toMatchObject({ name: 'Bench Press', notes: 'elbows in', restSeconds: 120 })
      expect(local.templates.size).toBe(0)
    })

    it('lets a migrated project clear a value that is still set locally', async () => {
      local.sessions.set('s1', session)
      seed('workout_sessions', [{ ...sessionRow, updated_at: 3, duration_seconds: null, planned_exercise_ids: null }])

      await pullAndHydrate('u1')

      expect(local.sessions.get('s1')).not.toHaveProperty('plannedExerciseIds')
      expect(local.sessions.get('s1')).not.toHaveProperty('durationSeconds')
    })

    it('keeps a local record that is newer than the cloud copy, and pushes it up', async () => {
      local.exercises.set('ex1', { ...exercise, name: 'Incline Bench', updatedAt: 9 })
      seed('exercises', [exerciseRow])

      expect(await pullAndHydrate('u1')).toBe(false)

      expect(local.exercises.get('ex1')).toMatchObject({ name: 'Incline Bench' })
      expect(cloud.tables.exercises).toMatchObject([{ id: 'ex1', name: 'Incline Bench', updated_at: 9 }])
    })

    it('reports no change when the device is already up to date', async () => {
      local.exercises.set('ex1', exercise)
      seed('exercises', [exerciseRow])

      expect(await pullAndHydrate('u1')).toBe(false)
    })

    it('reads past the 1000 rows Supabase returns per request', async () => {
      const rows = Array.from({ length: 2500 }, (_, i) => ({ ...sessionRow, id: `s${String(i).padStart(4, '0')}` }))
      seed('workout_sessions', rows)

      await pullAndHydrate('u1')

      expect(local.sessions.size).toBe(2500)
    })

    it("only reads the signed-in user's rows", async () => {
      seed('exercises', [exerciseRow], 'someone-else')

      await pullAndHydrate('u1')

      expect(local.exercises.size).toBe(0)
    })

    it('fails without touching local data when the cloud cannot be reached', async () => {
      local.exercises.set('ex1', exercise)
      tombstone('exercises', 'ex1', 5)
      cloud.offline = true

      await expect(pullAndHydrate('u1')).rejects.toBeTruthy()

      expect(local.exercises.has('ex1')).toBe(true)
    })
  })

  describe('after restoring a backup', () => {
    it('uploads restored records and lifts their tombstones instead of deleting them again', async () => {
      local.exercises.set('ex1', exercise)
      local.sessions.set('s1', session)
      tombstone('exercises', 'ex1', 5)
      markRestorePending()

      await pullAndHydrate('u1')

      expect(local.exercises.has('ex1')).toBe(true)
      expect(cloudIds('exercises')).toEqual(['ex1'])
      expect(cloudIds('workout_sessions')).toEqual(['s1'])
      expect(cloud.tables.deleted_records).toEqual([])
    })

    it('goes back to normal rules once the restored data has been uploaded', async () => {
      local.exercises.set('ex1', exercise)
      markRestorePending()
      await pullAndHydrate('u1')

      tombstone('exercises', 'ex1', 5)
      await pullAndHydrate('u1')

      expect(local.exercises.size).toBe(0)
    })

    it('keeps trying on later syncs when the upload fails', async () => {
      local.exercises.set('ex1', exercise)
      tombstone('exercises', 'ex1', 5)
      markRestorePending()
      cloud.upsertError = () => ({ code: '500' })
      await pullAndHydrate('u1')
      expect(local.exercises.has('ex1')).toBe(true)

      cloud.upsertError = () => null
      await pullAndHydrate('u1')

      expect(local.exercises.has('ex1')).toBe(true)
      expect(cloudIds('exercises')).toEqual(['ex1'])
    })

    it('skips a restored log whose date the cloud already has under another id', async () => {
      local.exercises.set('ex1', exercise)
      local.bodyWeight.set('w-local', { id: 'w-local', date: '2025-01-06', weightKg: 80, createdAt: 1, updatedAt: 2 })
      cloud.upsertError = (table) => (table === 'body_weight_logs' ? { code: '23505' } : null)
      markRestorePending()

      await pullAndHydrate('u1')

      expect(cloudIds('exercises')).toEqual(['ex1'])
      expect(localStorage.getItem('fittrack-sync-restore-pending')).toBeNull()
    })
  })

  it('syncWithCloud flushes the outbox before pulling, so queued edits are not overwritten', async () => {
    cloud.offline = true
    const edited = { ...exercise, name: 'Incline Bench', updatedAt: 9 }
    local.exercises.set('ex1', edited)
    await syncUpsertExercise('u1', edited)
    cloud.offline = false
    seed('exercises', [exerciseRow])

    expect(await syncWithCloud('u1')).toBe(false)

    expect(queued()).toEqual([])
    expect(local.exercises.get('ex1')).toMatchObject({ name: 'Incline Bench' })
    expect(cloud.tables.exercises).toMatchObject([{ name: 'Incline Bench' }])
  })

  it('round-trips a cardio session through its row shape', async () => {
    const cardio = { id: 'c1', date: '2026-10-20', type: 'run' as const, durationSeconds: 1800, distanceKm: 5, avgHeartRate: 150, createdAt: 1, updatedAt: 2 }
    await syncUpsertCardioSession('u1', cardio)

    const row = cloud.upserts[0]!.row
    expect(cloud.upserts[0]!.table).toBe('cardio_sessions')
    expect(row).toMatchObject({ user_id: 'u1', duration_seconds: 1800, distance_km: 5, avg_heart_rate: 150, calories: null })

    await pullAndHydrate('u1')
    expect([...local.cardio.values()]).toEqual([cardio])
  })

  it('leaves local cardio alone when the cardio table does not exist yet', async () => {
    local.cardio.set('c1', { id: 'c1', updatedAt: 1 })
    cloud.missing.add('cardio_sessions')

    await pullAndHydrate('u1')

    expect(local.cardio.has('c1')).toBe(true)
  })

  describe('deleteAllCloudData', () => {
    it('clears every table and drops queued retries', async () => {
      seed('exercises', [exerciseRow])
      seed('routines', [routineRow])
      seed('workout_sessions', [sessionRow])
      localStorage.setItem(QUEUE_KEY, JSON.stringify([{ kind: 'upsert', table: 'workout_sessions', id: 's1', payload: session }]))

      await deleteAllCloudData('u1')

      for (const table of ['exercises', 'routines', 'workout_sessions']) expect(cloudIds(table)).toEqual([])
      expect(queued()).toEqual([])
    })

    it("clears the user's other devices on their next pull", async () => {
      seed('exercises', [exerciseRow])
      seed('workout_sessions', [sessionRow])
      local.exercises.set('ex1', exercise)
      local.sessions.set('s1', session)
      vi.spyOn(Date, 'now').mockReturnValue(100)

      await deleteAllCloudData('u1')
      await pullAndHydrate('u1')

      expect(local.exercises.size).toBe(0)
      expect(local.sessions.size).toBe(0)
      vi.restoreAllMocks()
    })

    it('copes with a project that is missing the newer tables', async () => {
      cloud.missing = new Set(['deleted_records', 'cardio_sessions', 'workout_templates'])
      seed('exercises', [exerciseRow])

      await deleteAllCloudData('u1')

      expect(cloudIds('exercises')).toEqual([])
    })
  })
})
