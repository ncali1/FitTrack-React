import { getSupabase, isCloudEnabled } from './supabaseClient'
import { storageService } from './storage'
import type { Exercise, Routine, WorkoutTemplate, WorkoutSession, BodyWeightLog } from '@/types'

/**
 * Bridges the local IndexedDB store (source of truth for instant reads/writes) with
 * Supabase Postgres (source of truth across devices). Strategy, chosen for a single user
 * syncing between a couple of personal devices — not a multi-writer collaborative app:
 *
 * - Every local mutation is pushed to Supabase in the background (fire-and-forget from the
 *   caller's perspective — UI never waits on the network).
 * - If a push fails (offline, etc.) it's queued in localStorage and retried on the next
 *   `flushQueue()` call, which runs on app boot and on the browser's `online` event.
 * - On sign-in / app boot, `pullAndHydrate()` fetches everything from Supabase and
 *   overwrites the local IndexedDB cache, so a second device always catches up to the
 *   latest state. This is last-write-wins at the table-row level, which is sufficient
 *   because the same person is never editing the same record on two devices at once.
 *
 * All functions are safe no-ops when cloud sync isn't configured.
 */

const QUEUE_KEY = 'fittrack-sync-queue'

type QueueOp =
  | { type: 'upsertExercise'; payload: Exercise }
  | { type: 'deleteExercise'; payload: { id: string } }
  | { type: 'upsertRoutine'; payload: Routine }
  | { type: 'deleteRoutine'; payload: { id: string } }
  | { type: 'upsertWorkoutTemplate'; payload: WorkoutTemplate }
  | { type: 'deleteWorkoutTemplate'; payload: { id: string } }
  | { type: 'upsertSession'; payload: WorkoutSession }
  | { type: 'deleteSession'; payload: { id: string } }
  | { type: 'upsertBodyWeightLog'; payload: BodyWeightLog }
  | { type: 'deleteBodyWeightLog'; payload: { id: string } }

function readQueue(): QueueOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeQueue(queue: QueueOp[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

/** Drops every queued retry — for a full data reset, so deleted records aren't re-uploaded later. */
export function clearSyncQueue() {
  writeQueue([])
}

function enqueue(op: QueueOp) {
  const queue = readQueue()
  queue.push(op)
  writeQueue(queue)
}

/**
 * Columns added to existing tables after the first schema release, mapped to the local
 * field each one carries. A project whose owner hasn't re-run supabase/schema.sql yet
 * won't have them, so both directions degrade instead of breaking: {@link upsertRow}
 * retries without them, and {@link keepLocalForMissingColumns} stops a pull from wiping
 * the local values they would have held.
 */
const OPTIONAL_COLUMNS = {
  exercises: { notes: 'notes', rest_seconds: 'restSeconds' },
  routines: { weekly_templates: 'weeklyTemplates' },
  workout_sessions: { duration_seconds: 'durationSeconds', planned_exercise_ids: 'plannedExerciseIds' },
} as const

type TableName = keyof typeof OPTIONAL_COLUMNS | 'workout_templates' | 'body_weight_logs'

/** PostgREST's error code for a payload column the table doesn't have. */
const UNKNOWN_COLUMN = 'PGRST204'

/** Upserts one row, retrying without {@link OPTIONAL_COLUMNS} if the table predates them. */
async function upsertRow(table: TableName, row: Record<string, unknown>) {
  const supabase = getSupabase()!
  const { error } = await supabase.from(table).upsert(row)
  if (!error) return

  const optional = table in OPTIONAL_COLUMNS ? Object.keys(OPTIONAL_COLUMNS[table as keyof typeof OPTIONAL_COLUMNS]) : []
  if (error.code !== UNKNOWN_COLUMN || optional.length === 0) throw error

  const base = Object.fromEntries(Object.entries(row).filter(([column]) => !optional.includes(column)))
  const retry = await supabase.from(table).upsert(base)
  if (retry.error) throw retry.error
}

/**
 * Copies onto `record` any optional field whose column is absent from the pulled `row`
 * (i.e. the table hasn't been migrated), taking the value from the local copy.
 */
function keepLocalForMissingColumns<T extends object>(
  table: keyof typeof OPTIONAL_COLUMNS,
  row: Record<string, unknown>,
  record: T,
  local: T | undefined
): T {
  if (!local) return record
  const merged = { ...record } as Record<string, unknown>
  for (const [column, field] of Object.entries(OPTIONAL_COLUMNS[table])) {
    if (!(column in row)) merged[field] = (local as Record<string, unknown>)[field]
  }
  return merged as T
}

/** Row shape sent to/received from the `exercises` table. */
function toExerciseRow(userId: string, e: Exercise) {
  return {
    id: e.id,
    user_id: userId,
    name: e.name,
    target_sets: e.targetSets,
    target_reps: e.targetReps,
    target_muscle_groups: e.targetMuscleGroups,
    notes: e.notes ?? null,
    rest_seconds: e.restSeconds ?? null,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  }
}

function fromExerciseRow(row: any): Exercise {
  return {
    id: row.id,
    name: row.name,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    targetMuscleGroups: row.target_muscle_groups ?? [],
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.rest_seconds ? { restSeconds: row.rest_seconds } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRoutineRow(userId: string, r: Routine) {
  return {
    id: r.id,
    user_id: userId,
    name: r.name,
    is_active: r.isActive,
    weekly_assignments: r.weeklyAssignments,
    weekly_templates: r.weeklyTemplates ?? {},
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }
}

function fromRoutineRow(row: any): Routine {
  return {
    id: row.id,
    name: row.name ?? 'My Routine',
    isActive: row.is_active ?? false,
    weeklyAssignments: row.weekly_assignments ?? {},
    ...(row.weekly_templates ? { weeklyTemplates: row.weekly_templates } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Row shape sent to/received from the `workout_templates` table. */
function toWorkoutTemplateRow(userId: string, t: WorkoutTemplate) {
  return {
    id: t.id,
    user_id: userId,
    name: t.name,
    exercise_ids: t.exerciseIds,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }
}

function fromWorkoutTemplateRow(row: any): WorkoutTemplate {
  return {
    id: row.id,
    name: row.name,
    exerciseIds: row.exercise_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toSessionRow(userId: string, s: WorkoutSession) {
  return {
    id: s.id,
    user_id: userId,
    date: s.date,
    exercises: s.exercises,
    duration_seconds: s.durationSeconds ?? null,
    planned_exercise_ids: s.plannedExerciseIds ?? null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }
}

function fromSessionRow(row: any): WorkoutSession {
  return {
    id: row.id,
    date: row.date,
    exercises: row.exercises ?? [],
    ...(row.duration_seconds != null ? { durationSeconds: row.duration_seconds } : {}),
    ...(row.planned_exercise_ids ? { plannedExerciseIds: row.planned_exercise_ids } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Row shape sent to/received from the `body_weight_logs` table. */
function toBodyWeightLogRow(userId: string, log: BodyWeightLog) {
  return {
    id: log.id,
    user_id: userId,
    date: log.date,
    weight_kg: log.weightKg,
    created_at: log.createdAt,
    updated_at: log.updatedAt,
  }
}

function fromBodyWeightLogRow(row: any): BodyWeightLog {
  return {
    id: row.id,
    date: row.date,
    weightKg: row.weight_kg,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Pushes a single exercise upsert to Supabase. Queues it for retry on failure. */
export async function syncUpsertExercise(userId: string, exercise: Exercise) {
  if (!isCloudEnabled()) return
  try {
    await upsertRow('exercises', toExerciseRow(userId, exercise))
  } catch {
    enqueue({ type: 'upsertExercise', payload: exercise })
  }
}

/** Pushes an exercise deletion to Supabase. Queues it for retry on failure. */
export async function syncDeleteExercise(userId: string, id: string) {
  if (!isCloudEnabled()) return
  try {
    const supabase = getSupabase()!
    const { error } = await supabase.from('exercises').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error
  } catch {
    enqueue({ type: 'deleteExercise', payload: { id } })
  }
}

/** Pushes the routine upsert to Supabase. Queues it for retry on failure. */
export async function syncUpsertRoutine(userId: string, routine: Routine) {
  if (!isCloudEnabled()) return
  try {
    await upsertRow('routines', toRoutineRow(userId, routine))
  } catch {
    enqueue({ type: 'upsertRoutine', payload: routine })
  }
}

/** Pushes a routine deletion to Supabase. Queues it for retry on failure. */
export async function syncDeleteRoutine(userId: string, id: string) {
  if (!isCloudEnabled()) return
  try {
    const supabase = getSupabase()!
    const { error } = await supabase.from('routines').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error
  } catch {
    enqueue({ type: 'deleteRoutine', payload: { id } })
  }
}

/** Pushes a workout template upsert to Supabase. Queues it for retry on failure. */
export async function syncUpsertWorkoutTemplate(userId: string, template: WorkoutTemplate) {
  if (!isCloudEnabled()) return
  try {
    await upsertRow('workout_templates', toWorkoutTemplateRow(userId, template))
  } catch {
    enqueue({ type: 'upsertWorkoutTemplate', payload: template })
  }
}

/** Pushes a workout template deletion to Supabase. Queues it for retry on failure. */
export async function syncDeleteWorkoutTemplate(userId: string, id: string) {
  if (!isCloudEnabled()) return
  try {
    const supabase = getSupabase()!
    const { error } = await supabase.from('workout_templates').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error
  } catch {
    enqueue({ type: 'deleteWorkoutTemplate', payload: { id } })
  }
}

/** Pushes a workout session upsert to Supabase. Queues it for retry on failure. */
export async function syncUpsertSession(userId: string, session: WorkoutSession) {
  if (!isCloudEnabled()) return
  try {
    await upsertRow('workout_sessions', toSessionRow(userId, session))
  } catch {
    enqueue({ type: 'upsertSession', payload: session })
  }
}

/** Pushes a workout session deletion to Supabase. Queues it for retry on failure. */
export async function syncDeleteSession(userId: string, id: string) {
  if (!isCloudEnabled()) return
  try {
    const supabase = getSupabase()!
    const { error } = await supabase.from('workout_sessions').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error
  } catch {
    enqueue({ type: 'deleteSession', payload: { id } })
  }
}

/** Pushes a body weight log upsert to Supabase. Queues it for retry on failure. */
export async function syncUpsertBodyWeightLog(userId: string, log: BodyWeightLog) {
  if (!isCloudEnabled()) return
  try {
    const supabase = getSupabase()!
    const { error } = await supabase.from('body_weight_logs').upsert(toBodyWeightLogRow(userId, log))
    if (error) throw error
  } catch {
    enqueue({ type: 'upsertBodyWeightLog', payload: log })
  }
}

/** Pushes a body weight log deletion to Supabase. Queues it for retry on failure. */
export async function syncDeleteBodyWeightLog(userId: string, id: string) {
  if (!isCloudEnabled()) return
  try {
    const supabase = getSupabase()!
    const { error } = await supabase.from('body_weight_logs').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error
  } catch {
    enqueue({ type: 'deleteBodyWeightLog', payload: { id } })
  }
}

/**
 * Retries any queued operations left over from a previous offline period.
 * Safe to call repeatedly — clears each op from the queue only once it succeeds.
 */
export async function flushQueue(userId: string) {
  if (!isCloudEnabled()) return
  const queue = readQueue()
  if (queue.length === 0) return

  const remaining: QueueOp[] = []
  for (const op of queue) {
    try {
      const supabase = getSupabase()!
      if (op.type === 'upsertExercise') {
        await upsertRow('exercises', toExerciseRow(userId, op.payload))
      } else if (op.type === 'deleteExercise') {
        const { error } = await supabase.from('exercises').delete().eq('id', op.payload.id).eq('user_id', userId)
        if (error) throw error
      } else if (op.type === 'upsertRoutine') {
        await upsertRow('routines', toRoutineRow(userId, op.payload))
      } else if (op.type === 'deleteRoutine') {
        const { error } = await supabase.from('routines').delete().eq('id', op.payload.id).eq('user_id', userId)
        if (error) throw error
      } else if (op.type === 'upsertWorkoutTemplate') {
        await upsertRow('workout_templates', toWorkoutTemplateRow(userId, op.payload))
      } else if (op.type === 'deleteWorkoutTemplate') {
        const { error } = await supabase
          .from('workout_templates')
          .delete()
          .eq('id', op.payload.id)
          .eq('user_id', userId)
        if (error) throw error
      } else if (op.type === 'upsertSession') {
        await upsertRow('workout_sessions', toSessionRow(userId, op.payload))
      } else if (op.type === 'deleteSession') {
        const { error } = await supabase
          .from('workout_sessions')
          .delete()
          .eq('id', op.payload.id)
          .eq('user_id', userId)
        if (error) throw error
      } else if (op.type === 'upsertBodyWeightLog') {
        const { error } = await supabase.from('body_weight_logs').upsert(toBodyWeightLogRow(userId, op.payload))
        if (error) throw error
      } else if (op.type === 'deleteBodyWeightLog') {
        const { error } = await supabase
          .from('body_weight_logs')
          .delete()
          .eq('id', op.payload.id)
          .eq('user_id', userId)
        if (error) throw error
      }
    } catch {
      remaining.push(op)
    }
  }
  writeQueue(remaining)
}

/**
 * Pulls everything from Supabase and overwrites the local IndexedDB cache. Call this
 * right after sign-in and on app boot (while authenticated) so a second device catches
 * up to the latest cloud state.
 */
export async function pullAndHydrate(userId: string) {
  if (!isCloudEnabled()) return
  const supabase = getSupabase()!

  const [exercisesRes, routinesRes, templatesRes, sessionsRes, bodyWeightLogsRes] = await Promise.all([
    supabase.from('exercises').select('*').eq('user_id', userId),
    supabase.from('routines').select('*').eq('user_id', userId),
    supabase.from('workout_templates').select('*').eq('user_id', userId),
    supabase.from('workout_sessions').select('*').eq('user_id', userId),
    supabase.from('body_weight_logs').select('*').eq('user_id', userId),
  ])

  const byId = <T extends { id: string }>(records: T[]) => new Map(records.map((r) => [r.id, r]))

  if (exercisesRes.data) {
    const local = byId(await storageService.getAllExercises())
    for (const row of exercisesRes.data) {
      const exercise = fromExerciseRow(row)
      await storageService.saveExercise(keepLocalForMissingColumns('exercises', row, exercise, local.get(exercise.id)))
    }
  }
  if (routinesRes.data) {
    const local = byId(await storageService.getAllRoutines())
    for (const row of routinesRes.data) {
      const routine = fromRoutineRow(row)
      await storageService.saveRoutine(keepLocalForMissingColumns('routines', row, routine, local.get(routine.id)))
    }
  }
  // `data` is null (with an error) when the table doesn't exist yet — local templates are left alone.
  if (templatesRes.data) {
    for (const row of templatesRes.data) {
      await storageService.saveWorkoutTemplate(fromWorkoutTemplateRow(row))
    }
  }
  if (sessionsRes.data) {
    const local = byId(await storageService.getAllWorkoutSessions())
    for (const row of sessionsRes.data) {
      const session = fromSessionRow(row)
      await storageService.saveWorkoutSession(
        keepLocalForMissingColumns('workout_sessions', row, session, local.get(session.id))
      )
    }
  }
  if (bodyWeightLogsRes.data) {
    for (const row of bodyWeightLogsRes.data) {
      await storageService.saveBodyWeightLog(fromBodyWeightLogRow(row))
    }
  }
}

/**
 * Deletes every row this user owns in Supabase and drops any queued retries, for a full
 * "delete all my data" reset. Throws if any table fails, so the caller can stop before
 * wiping the local copy and leave the two in step.
 */
export async function deleteAllCloudData(userId: string) {
  if (!isCloudEnabled()) return
  const supabase = getSupabase()!
  const tables: TableName[] = ['workout_sessions', 'body_weight_logs', 'routines', 'workout_templates', 'exercises']
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId)
    // 42P01 / PGRST205: the table was never created, so there is nothing to delete.
    if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw error
  }
  clearSyncQueue()
}

// Auto-flush the queue whenever connectivity returns.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const supabase = getSupabase()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id
      if (userId) flushQueue(userId)
    })
  })
}
