import { getSupabase, isCloudEnabled } from './supabaseClient'
import { storageService } from './storage'
import type { Exercise, Routine, WorkoutSession, BodyWeightLog } from '@/types'

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

function enqueue(op: QueueOp) {
  const queue = readQueue()
  queue.push(op)
  writeQueue(queue)
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
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }
}

function fromSessionRow(row: any): WorkoutSession {
  return {
    id: row.id,
    date: row.date,
    exercises: row.exercises ?? [],
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
    const supabase = getSupabase()!
    const { error } = await supabase.from('exercises').upsert(toExerciseRow(userId, exercise))
    if (error) throw error
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
    const supabase = getSupabase()!
    const { error } = await supabase.from('routines').upsert(toRoutineRow(userId, routine))
    if (error) throw error
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

/** Pushes a workout session upsert to Supabase. Queues it for retry on failure. */
export async function syncUpsertSession(userId: string, session: WorkoutSession) {
  if (!isCloudEnabled()) return
  try {
    const supabase = getSupabase()!
    const { error } = await supabase.from('workout_sessions').upsert(toSessionRow(userId, session))
    if (error) throw error
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
        const { error } = await supabase.from('exercises').upsert(toExerciseRow(userId, op.payload))
        if (error) throw error
      } else if (op.type === 'deleteExercise') {
        const { error } = await supabase.from('exercises').delete().eq('id', op.payload.id).eq('user_id', userId)
        if (error) throw error
      } else if (op.type === 'upsertRoutine') {
        const { error } = await supabase.from('routines').upsert(toRoutineRow(userId, op.payload))
        if (error) throw error
      } else if (op.type === 'deleteRoutine') {
        const { error } = await supabase.from('routines').delete().eq('id', op.payload.id).eq('user_id', userId)
        if (error) throw error
      } else if (op.type === 'upsertSession') {
        const { error } = await supabase.from('workout_sessions').upsert(toSessionRow(userId, op.payload))
        if (error) throw error
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

  const [exercisesRes, routinesRes, sessionsRes, bodyWeightLogsRes] = await Promise.all([
    supabase.from('exercises').select('*').eq('user_id', userId),
    supabase.from('routines').select('*').eq('user_id', userId),
    supabase.from('workout_sessions').select('*').eq('user_id', userId),
    supabase.from('body_weight_logs').select('*').eq('user_id', userId),
  ])

  if (exercisesRes.data) {
    for (const row of exercisesRes.data) {
      await storageService.saveExercise(fromExerciseRow(row))
    }
  }
  if (routinesRes.data) {
    for (const row of routinesRes.data) {
      await storageService.saveRoutine(fromRoutineRow(row))
    }
  }
  if (sessionsRes.data) {
    for (const row of sessionsRes.data) {
      await storageService.saveWorkoutSession(fromSessionRow(row))
    }
  }
  if (bodyWeightLogsRes.data) {
    for (const row of bodyWeightLogsRes.data) {
      await storageService.saveBodyWeightLog(fromBodyWeightLogRow(row))
    }
  }
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
