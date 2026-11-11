import { getSupabase, isCloudEnabled } from './supabaseClient'
import { storageService } from './storage'
import type { Exercise, Routine, WorkoutTemplate, WorkoutSession, BodyWeightLog, CardioSession } from '@/types'

/**
 * Bridges the local IndexedDB store (source of truth for instant reads/writes) with
 * Supabase Postgres (source of truth across devices). Strategy, chosen for a single user
 * syncing between a couple of personal devices — not a multi-writer collaborative app:
 *
 * - Every local mutation goes into an outbox in localStorage and is pushed to Supabase in
 *   the background (fire-and-forget — the UI never waits on the network). It leaves the
 *   outbox only once the push succeeds, so a failed or interrupted push is retried by the
 *   next `flushQueue()`, which runs on app boot and on the browser's `online` event.
 * - The outbox holds at most one operation per record (the latest), tagged with the user
 *   it belongs to, so it stays small and is never uploaded into someone else's account.
 * - A delete writes a tombstone to `deleted_records` and then removes the row. Other
 *   devices delete their local copy when they pull the tombstone — a record that is merely
 *   absent from the cloud is never deleted locally, since it may simply not be uploaded yet.
 * - On sign-in / app boot, `syncWithCloud()` flushes the outbox and then pulls. Conflicts
 *   are last-write-wins per record on `updatedAt`: a newer cloud row replaces the local
 *   record, a newer local record is kept and pushed back up, and a tombstone wins over
 *   any copy last edited before the delete.
 *
 * Every table is described once in {@link TABLES}; pushing, queueing, flushing and pulling
 * are generic over that description. All functions are safe no-ops when cloud sync isn't
 * configured.
 */

const QUEUE_KEY = 'fittrack-sync-queue'
const RESTORE_PENDING_KEY = 'fittrack-sync-restore-pending'
const TOMBSTONES = 'deleted_records'

/** Supabase returns at most this many rows per request by default, so reads are paged. */
const PAGE_SIZE = 1000
/** Keeps `in (…)` filters, which travel in the URL, comfortably under URL length limits. */
const ID_CHUNK = 100

/** PostgREST's error code for a payload column the table doesn't have. */
const UNKNOWN_COLUMN = 'PGRST204'
/** Postgres' unique-violation code, e.g. a second row for a `(user_id, date)` already taken. */
const UNIQUE_VIOLATION = '23505'

/** `true` for the errors Postgres / PostgREST give when a table was never created. */
function isMissingTable(error: { code?: string }): boolean {
  return error.code === '42P01' || error.code === 'PGRST205'
}

type TableName =
  | 'exercises'
  | 'routines'
  | 'workout_templates'
  | 'workout_sessions'
  | 'body_weight_logs'
  | 'cardio_sessions'

/** What every synced record has in common. */
interface SyncRecord {
  id: string
  updatedAt: number
}

/** What every cloud row has in common. */
interface BaseRow {
  id: string
  user_id?: string
  created_at: number
  updated_at: number
}

interface ExerciseRow extends BaseRow {
  name: string
  target_sets: number
  target_reps: number
  target_muscle_groups: string[] | null
  notes?: string | null
  rest_seconds?: number | null
}

interface RoutineRow extends BaseRow {
  name: string | null
  is_active: boolean | null
  weekly_assignments: Routine['weeklyAssignments'] | null
  weekly_templates?: Routine['weeklyTemplates'] | null
}

interface WorkoutTemplateRow extends BaseRow {
  name: string
  exercise_ids: string[] | null
}

interface SessionRow extends BaseRow {
  date: string
  exercises: WorkoutSession['exercises'] | null
  duration_seconds?: number | null
  planned_exercise_ids?: string[] | null
}

interface BodyWeightLogRow extends BaseRow {
  date: string
  weight_kg: number
}

interface CardioSessionRow extends BaseRow {
  date: string
  type: CardioSession['type']
  duration_seconds: number
  distance_km: number | null
  avg_heart_rate: number | null
  calories: number | null
  notes: string | null
}

/**
 * Everything sync needs to know about one table: its row mapping and how to reach the
 * local copy. Members are declared as methods (not function properties) on purpose —
 * that is what lets a `SyncTable<Exercise, ExerciseRow>` sit in {@link TABLES} next to
 * the others and be driven by code that only knows `SyncRecord`.
 */
interface SyncTable<T extends SyncRecord = SyncRecord, R extends BaseRow = BaseRow> {
  /**
   * Columns added after the first schema release, mapped to the local field each one
   * carries. A project whose owner hasn't re-run supabase/schema.sql yet won't have them,
   * so both directions degrade instead of breaking: {@link upsertRows} retries without
   * them, and {@link keepLocalForMissingColumns} stops a pull from wiping the local
   * values they would have held.
   */
  optionalColumns: Record<string, string>
  toRow(userId: string, record: T): R
  fromRow(row: R): T
  loadLocal(): Promise<T[]>
  saveLocal(record: T): Promise<void>
  deleteLocal(id: string): Promise<void>
}

const exercisesTable: SyncTable<Exercise, ExerciseRow> = {
  optionalColumns: { notes: 'notes', rest_seconds: 'restSeconds' },
  toRow: (userId, e) => ({
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
  }),
  fromRow: (row) => ({
    id: row.id,
    name: row.name,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    targetMuscleGroups: row.target_muscle_groups ?? [],
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.rest_seconds ? { restSeconds: row.rest_seconds } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),
  loadLocal: () => storageService.getAllExercises(),
  saveLocal: (exercise) => storageService.saveExercise(exercise),
  deleteLocal: (id) => storageService.deleteExercise(id),
}

const routinesTable: SyncTable<Routine, RoutineRow> = {
  optionalColumns: { weekly_templates: 'weeklyTemplates' },
  toRow: (userId, r) => ({
    id: r.id,
    user_id: userId,
    name: r.name,
    is_active: r.isActive,
    weekly_assignments: r.weeklyAssignments,
    weekly_templates: r.weeklyTemplates ?? {},
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }),
  fromRow: (row) => ({
    id: row.id,
    name: row.name ?? 'My Routine',
    isActive: row.is_active ?? false,
    weeklyAssignments: row.weekly_assignments ?? {},
    ...(row.weekly_templates ? { weeklyTemplates: row.weekly_templates } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),
  loadLocal: () => storageService.getAllRoutines(),
  saveLocal: (routine) => storageService.saveRoutine(routine),
  deleteLocal: (id) => storageService.deleteRoutine(id),
}

const workoutTemplatesTable: SyncTable<WorkoutTemplate, WorkoutTemplateRow> = {
  optionalColumns: {},
  toRow: (userId, t) => ({
    id: t.id,
    user_id: userId,
    name: t.name,
    exercise_ids: t.exerciseIds,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }),
  fromRow: (row) => ({
    id: row.id,
    name: row.name,
    exerciseIds: row.exercise_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),
  loadLocal: () => storageService.getAllWorkoutTemplates(),
  saveLocal: (template) => storageService.saveWorkoutTemplate(template),
  deleteLocal: (id) => storageService.deleteWorkoutTemplate(id),
}

const sessionsTable: SyncTable<WorkoutSession, SessionRow> = {
  optionalColumns: { duration_seconds: 'durationSeconds', planned_exercise_ids: 'plannedExerciseIds' },
  toRow: (userId, s) => ({
    id: s.id,
    user_id: userId,
    date: s.date,
    exercises: s.exercises,
    duration_seconds: s.durationSeconds ?? null,
    planned_exercise_ids: s.plannedExerciseIds ?? null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }),
  fromRow: (row) => ({
    id: row.id,
    date: row.date,
    exercises: row.exercises ?? [],
    ...(row.duration_seconds != null ? { durationSeconds: row.duration_seconds } : {}),
    ...(row.planned_exercise_ids ? { plannedExerciseIds: row.planned_exercise_ids } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),
  loadLocal: () => storageService.getAllWorkoutSessions(),
  saveLocal: (session) => storageService.saveWorkoutSession(session),
  deleteLocal: (id) => storageService.deleteWorkoutSession(id),
}

const bodyWeightLogsTable: SyncTable<BodyWeightLog, BodyWeightLogRow> = {
  optionalColumns: {},
  toRow: (userId, log) => ({
    id: log.id,
    user_id: userId,
    date: log.date,
    weight_kg: log.weightKg,
    created_at: log.createdAt,
    updated_at: log.updatedAt,
  }),
  fromRow: (row) => ({
    id: row.id,
    date: row.date,
    weightKg: row.weight_kg,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),
  loadLocal: () => storageService.getAllBodyWeightLogs(),
  saveLocal: (log) => storageService.saveBodyWeightLog(log),
  deleteLocal: (id) => storageService.deleteBodyWeightLog(id),
}

const cardioSessionsTable: SyncTable<CardioSession, CardioSessionRow> = {
  optionalColumns: {},
  toRow: (userId, s) => ({
    id: s.id,
    user_id: userId,
    date: s.date,
    type: s.type,
    duration_seconds: s.durationSeconds,
    distance_km: s.distanceKm ?? null,
    avg_heart_rate: s.avgHeartRate ?? null,
    calories: s.calories ?? null,
    notes: s.notes ?? null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }),
  fromRow: (row) => ({
    id: row.id,
    date: row.date,
    type: row.type,
    durationSeconds: row.duration_seconds,
    ...(row.distance_km != null ? { distanceKm: row.distance_km } : {}),
    ...(row.avg_heart_rate != null ? { avgHeartRate: row.avg_heart_rate } : {}),
    ...(row.calories != null ? { calories: row.calories } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),
  loadLocal: () => storageService.getAllCardioSessions(),
  saveLocal: (session) => storageService.saveCardioSession(session),
  deleteLocal: (id) => storageService.deleteCardioSession(id),
}

/**
 * Every synced table. Order matters only to {@link deleteAllCloudData}, which clears
 * them top to bottom — records first, the exercises they refer to last.
 */
const TABLES: Record<TableName, SyncTable> = {
  workout_sessions: sessionsTable,
  cardio_sessions: cardioSessionsTable,
  body_weight_logs: bodyWeightLogsTable,
  routines: routinesTable,
  workout_templates: workoutTemplatesTable,
  exercises: exercisesTable,
}

const TABLE_NAMES = Object.keys(TABLES) as TableName[]

// ── Outbox ──────────────────────────────────────────────────────────────────

type QueueOp =
  | { kind: 'upsert'; table: TableName; id: string; userId?: string; payload: SyncRecord }
  | { kind: 'delete'; table: TableName; id: string; userId?: string; deletedAt: number }

/** The queue's shape before it became table-driven, e.g. `{ type: 'upsertExercise', payload }`. */
interface LegacyQueueOp {
  type: string
  payload: SyncRecord
}

const LEGACY_TABLES: Record<string, TableName> = {
  Exercise: 'exercises',
  Routine: 'routines',
  WorkoutTemplate: 'workout_templates',
  Session: 'workout_sessions',
  BodyWeightLog: 'body_weight_logs',
  CardioSession: 'cardio_sessions',
}

/**
 * Converts an op queued by an older version of the app, so retries waiting in someone's
 * localStorage survive the upgrade. Those ops carry no user, and are flushed by whoever
 * is signed in — as they always were.
 */
function fromLegacyOp(op: LegacyQueueOp): QueueOp | null {
  const match = /^(upsert|delete)(.+)$/.exec(op.type)
  const table = match ? LEGACY_TABLES[match[2]!] : undefined
  if (!match || !table || !op.payload?.id) return null
  return match[1] === 'upsert'
    ? { kind: 'upsert', table, id: op.payload.id, payload: op.payload }
    : { kind: 'delete', table, id: op.payload.id, deletedAt: Date.now() }
}

function readQueue(): QueueOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed: (QueueOp | LegacyQueueOp)[] = raw ? JSON.parse(raw) : []
    if (!parsed.some((op) => 'type' in op)) return parsed as QueueOp[]

    const converted = parsed
      .map((op) => ('type' in op ? fromLegacyOp(op) : op))
      .filter((op): op is QueueOp => op !== null)
    // Written straight back so a converted delete keeps one `deletedAt` from here on.
    writeQueue(converted)
    return converted
  } catch {
    return []
  }
}

function writeQueue(queue: QueueOp[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

const sameRecord = (a: QueueOp, b: QueueOp) => a.table === b.table && a.id === b.id && a.userId === b.userId

/** Adds an op, replacing any older one for the same record — only the latest matters. */
function enqueue(op: QueueOp) {
  writeQueue([...readQueue().filter((queued) => !sameRecord(queued, op)), op])
}

/**
 * Removes an op that has been sent. Matches on its exact contents rather than its record,
 * so a newer op queued for the same record while this one was in flight stays put.
 */
function dequeue(op: QueueOp) {
  const sent = JSON.stringify(op)
  writeQueue(readQueue().filter((queued) => JSON.stringify(queued) !== sent))
}

/** Drops every queued retry — for a full data reset, so deleted records aren't re-uploaded later. */
export function clearSyncQueue() {
  writeQueue([])
  localStorage.removeItem(RESTORE_PENDING_KEY)
}

// ── Talking to Supabase ─────────────────────────────────────────────────────

/** Upserts rows, retrying without the table's optional columns if it predates them. */
async function upsertRows(tableName: TableName, rows: BaseRow[]) {
  if (rows.length === 0) return
  const supabase = getSupabase()!
  const { error } = await supabase.from(tableName).upsert(rows)
  if (!error) return

  const optional = Object.keys(TABLES[tableName].optionalColumns)
  if (error.code !== UNKNOWN_COLUMN || optional.length === 0) throw error

  const withoutOptional = rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([column]) => !optional.includes(column)))
  )
  const retry = await supabase.from(tableName).upsert(withoutOptional)
  if (retry.error) throw retry.error
}

/**
 * Records that these ids were deleted, so other devices drop their copies on their next
 * pull. A project that hasn't re-run the schema has no tombstone table: the delete still
 * goes ahead, it just won't reach the other devices.
 */
async function writeTombstones(userId: string, tableName: TableName, ids: string[], deletedAt: number) {
  const supabase = getSupabase()!
  for (let i = 0; i < ids.length; i += PAGE_SIZE) {
    const rows = ids
      .slice(i, i + PAGE_SIZE)
      .map((id) => ({ user_id: userId, table_name: tableName, record_id: id, deleted_at: deletedAt }))
    const { error } = await supabase.from(TOMBSTONES).upsert(rows, { onConflict: 'user_id,table_name,record_id' })
    if (error && !isMissingTable(error)) throw error
  }
}

/** Sends one outbox op to Supabase, throwing if it didn't go through. */
async function send(userId: string, op: QueueOp) {
  if (op.kind === 'upsert') {
    await upsertRows(op.table, [TABLES[op.table].toRow(userId, op.payload)])
    return
  }
  await writeTombstones(userId, op.table, [op.id], op.deletedAt)
  const { error } = await getSupabase()!.from(op.table).delete().eq('id', op.id).eq('user_id', userId)
  if (error) throw error
}

/**
 * Queues an op and tries to send it straight away. Never throws: callers don't await it,
 * and a failed sync must not surface as an unhandled rejection mid-workout.
 */
async function push(userId: string, op: QueueOp) {
  if (!isCloudEnabled()) return
  try {
    enqueue(op)
  } catch (err) {
    console.error('Failed to queue a change for cloud sync:', err)
  }
  try {
    await send(userId, op)
    dequeue(op)
  } catch {
    // Stays in the outbox for the next flushQueue().
  }
}

const pushUpsert = (userId: string, table: TableName, record: SyncRecord) =>
  push(userId, { kind: 'upsert', table, id: record.id, userId, payload: record })

const pushDelete = (userId: string, table: TableName, id: string) =>
  push(userId, { kind: 'delete', table, id, userId, deletedAt: Date.now() })

/** Pushes a single exercise upsert to Supabase. Queued for retry until it succeeds. */
export const syncUpsertExercise = (userId: string, exercise: Exercise) => pushUpsert(userId, 'exercises', exercise)
/** Pushes an exercise deletion to Supabase. Queued for retry until it succeeds. */
export const syncDeleteExercise = (userId: string, id: string) => pushDelete(userId, 'exercises', id)

/** Pushes a routine (weekly program) upsert to Supabase. Queued for retry until it succeeds. */
export const syncUpsertRoutine = (userId: string, routine: Routine) => pushUpsert(userId, 'routines', routine)
/** Pushes a routine deletion to Supabase. Queued for retry until it succeeds. */
export const syncDeleteRoutine = (userId: string, id: string) => pushDelete(userId, 'routines', id)

/** Pushes a workout template upsert to Supabase. Queued for retry until it succeeds. */
export const syncUpsertWorkoutTemplate = (userId: string, template: WorkoutTemplate) =>
  pushUpsert(userId, 'workout_templates', template)
/** Pushes a workout template deletion to Supabase. Queued for retry until it succeeds. */
export const syncDeleteWorkoutTemplate = (userId: string, id: string) => pushDelete(userId, 'workout_templates', id)

/** Pushes a workout session upsert to Supabase. Queued for retry until it succeeds. */
export const syncUpsertSession = (userId: string, session: WorkoutSession) =>
  pushUpsert(userId, 'workout_sessions', session)
/** Pushes a workout session deletion to Supabase. Queued for retry until it succeeds. */
export const syncDeleteSession = (userId: string, id: string) => pushDelete(userId, 'workout_sessions', id)

/** Pushes a body weight log upsert to Supabase. Queued for retry until it succeeds. */
export const syncUpsertBodyWeightLog = (userId: string, log: BodyWeightLog) =>
  pushUpsert(userId, 'body_weight_logs', log)
/** Pushes a body weight log deletion to Supabase. Queued for retry until it succeeds. */
export const syncDeleteBodyWeightLog = (userId: string, id: string) => pushDelete(userId, 'body_weight_logs', id)

/** Pushes a cardio session upsert to Supabase. Queued for retry until it succeeds. */
export const syncUpsertCardioSession = (userId: string, session: CardioSession) =>
  pushUpsert(userId, 'cardio_sessions', session)
/** Pushes a cardio session deletion to Supabase. Queued for retry until it succeeds. */
export const syncDeleteCardioSession = (userId: string, id: string) => pushDelete(userId, 'cardio_sessions', id)

let flushInFlight: Promise<void> | null = null

async function sendQueued(userId: string) {
  const mine = readQueue().filter((op) => op.userId === undefined || op.userId === userId)
  for (const op of mine) {
    try {
      await send(userId, op)
      dequeue(op)
    } catch {
      // Left in the outbox for next time.
    }
  }
}

/**
 * Retries the operations left in the outbox by an offline period or an interrupted push.
 * Safe to call repeatedly: overlapping calls share one run, each op leaves the outbox only
 * once it succeeds, and ops queued for a different account are left for that account.
 */
export function flushQueue(userId: string): Promise<void> {
  if (!isCloudEnabled()) return Promise.resolve()
  // Cleared via .finally(), which always runs after this assignment — a `finally` block
  // inside the run would fire first when there is nothing to await, leaving it set forever.
  flushInFlight ??= sendQueued(userId).finally(() => {
    flushInFlight = null
  })
  return flushInFlight
}

// ── Pulling ─────────────────────────────────────────────────────────────────

/**
 * Reads every row this user has in a table, a page at a time. Returns `null` when the
 * table doesn't exist yet (the schema hasn't been re-run), and throws on anything else so
 * a half-fetched pull is never applied.
 */
async function fetchAll<R>(tableName: string, columns: string, orderBy: string, userId: string): Promise<R[] | null> {
  const supabase = getSupabase()!
  const rows: R[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(tableName)
      .select(columns)
      .eq('user_id', userId)
      .order(orderBy)
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      if (isMissingTable(error)) return null
      throw error
    }
    const page = (data ?? []) as R[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

interface TombstoneRow {
  table_name: string
  record_id: string
  deleted_at: number
}

/** Tombstones grouped by table: record id → when it was deleted. */
async function fetchTombstones(userId: string): Promise<Map<string, Map<string, number>>> {
  const rows = await fetchAll<TombstoneRow>(TOMBSTONES, 'table_name,record_id,deleted_at', 'record_id', userId)
  const byTable = new Map<string, Map<string, number>>()
  for (const row of rows ?? []) {
    if (!byTable.has(row.table_name)) byTable.set(row.table_name, new Map())
    byTable.get(row.table_name)!.set(row.record_id, row.deleted_at)
  }
  return byTable
}

/**
 * Copies onto `record` any optional field whose column is absent from the pulled `row`
 * (i.e. the table hasn't been migrated), taking the value from the local copy.
 */
function keepLocalForMissingColumns<T extends SyncRecord>(
  table: SyncTable<T>,
  row: BaseRow,
  record: T,
  local: T | undefined
): T {
  if (!local) return record
  const merged = { ...record } as unknown as Record<string, unknown>
  for (const [column, field] of Object.entries(table.optionalColumns)) {
    if (!(column in row)) merged[field] = (local as unknown as Record<string, unknown>)[field]
  }
  return merged as unknown as T
}

/** What reconciling one table found that the cloud still needs to be told. */
interface Outgoing {
  tableName: TableName
  /** Local records the cloud has an older copy of, or (after a restore) no copy of. */
  toPush: SyncRecord[]
  /** Tombstoned ids a backup restore brought back, whose tombstones must go. */
  toRevive: string[]
}

/**
 * Brings one table's local copy in line with what was pulled, and reports whether any
 * local record changed. `restoring` is set for the first sync after a backup import: the
 * restored records then win over tombstones and are uploaded, rather than being deleted
 * again because they were once deleted.
 */
async function reconcileTable(
  tableName: TableName,
  rows: BaseRow[],
  tombstones: Map<string, number>,
  pendingDeletes: Set<string>,
  restoring: boolean
): Promise<{ changed: boolean; outgoing: Outgoing }> {
  const table = TABLES[tableName]
  const local = new Map((await table.loadLocal()).map((record) => [record.id, record]))
  const outgoing: Outgoing = { tableName, toPush: [], toRevive: [] }
  let changed = false

  /** `true` when the record was deleted elsewhere at or after the given edit time. */
  const deletedSince = (id: string, updatedAt: number) => {
    const deletedAt = tombstones.get(id)
    return deletedAt !== undefined && deletedAt >= updatedAt
  }

  if (restoring) {
    for (const id of local.keys()) {
      if (tombstones.has(id)) {
        outgoing.toRevive.push(id)
        tombstones.delete(id)
      }
    }
  }

  const cloudIds = new Set<string>()
  for (const row of rows) {
    const record = table.fromRow(row)
    cloudIds.add(record.id)
    // Deleted here but the delete hasn't reached the cloud yet — don't bring it back.
    if (pendingDeletes.has(record.id)) continue
    if (deletedSince(record.id, record.updatedAt)) continue

    const mine = local.get(record.id)
    if (mine && mine.updatedAt > record.updatedAt) {
      outgoing.toPush.push(mine)
    } else if (!mine || mine.updatedAt < record.updatedAt) {
      await table.saveLocal(keepLocalForMissingColumns(table, row, record, mine))
      changed = true
    }
  }

  for (const [id, mine] of local) {
    if (deletedSince(id, mine.updatedAt)) {
      await table.deleteLocal(id)
      changed = true
    } else if (restoring && !cloudIds.has(id)) {
      outgoing.toPush.push(mine)
    }
  }

  return { changed, outgoing }
}

/**
 * Uploads what a pull found the cloud was missing. A row that collides with another
 * record for the same date (two devices each logged that day) is skipped rather than
 * failing the batch — the cloud's copy stands.
 */
async function pushOutgoing(userId: string, { tableName, toPush, toRevive }: Outgoing) {
  const supabase = getSupabase()!
  for (let i = 0; i < toRevive.length; i += ID_CHUNK) {
    const { error } = await supabase
      .from(TOMBSTONES)
      .delete()
      .eq('user_id', userId)
      .eq('table_name', tableName)
      .in('record_id', toRevive.slice(i, i + ID_CHUNK))
    if (error && !isMissingTable(error)) throw error
  }

  const rows = toPush.map((record) => TABLES[tableName].toRow(userId, record))
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    const batch = rows.slice(i, i + PAGE_SIZE)
    try {
      await upsertRows(tableName, batch)
    } catch {
      for (const row of batch) {
        try {
          await upsertRows(tableName, [row])
        } catch (err) {
          if ((err as { code?: string }).code !== UNIQUE_VIOLATION) throw err
        }
      }
    }
  }
}

/**
 * Pulls everything from Supabase and reconciles the local IndexedDB copy with it (see the
 * header for the rules). Resolves `true` when local data changed, so the caller knows to
 * reload its stores. Throws if the cloud can't be read, before touching anything local.
 */
export async function pullAndHydrate(userId: string): Promise<boolean> {
  if (!isCloudEnabled()) return false

  const [tombstones, ...tableRows] = await Promise.all([
    fetchTombstones(userId),
    ...TABLE_NAMES.map((name) => fetchAll<BaseRow>(name, '*', 'id', userId)),
  ])

  const restoring = localStorage.getItem(RESTORE_PENDING_KEY) !== null
  const queue = readQueue()
  const outgoing: Outgoing[] = []
  let changed = false

  for (const [index, tableName] of TABLE_NAMES.entries()) {
    const rows = tableRows[index]
    // `null` means the table doesn't exist yet — its local records are left alone.
    if (!rows) continue
    const pendingDeletes = new Set(
      queue.filter((op) => op.kind === 'delete' && op.table === tableName).map((op) => op.id)
    )
    const result = await reconcileTable(
      tableName,
      rows,
      tombstones.get(tableName) ?? new Map(),
      pendingDeletes,
      restoring
    )
    changed ||= result.changed
    outgoing.push(result.outgoing)
  }

  try {
    for (const batch of outgoing) await pushOutgoing(userId, batch)
    localStorage.removeItem(RESTORE_PENDING_KEY)
  } catch (err) {
    // Local data is already up to date; the upload is retried by the next sync.
    console.error('Failed to push newer local records to the cloud:', err)
  }

  return changed
}

let syncInFlight: Promise<boolean> | null = null

/**
 * One full sync: flush the outbox, then pull. Resolves `true` when local data changed.
 * Run it in the background after local data has loaded — never before, since the app
 * must be usable without waiting on the network. Overlapping calls share one run.
 */
export function syncWithCloud(userId: string): Promise<boolean> {
  if (!isCloudEnabled()) return Promise.resolve(false)
  syncInFlight ??= flushQueue(userId)
    .then(() => pullAndHydrate(userId))
    .finally(() => {
      syncInFlight = null
    })
  return syncInFlight
}

/**
 * Call after a backup import. The next sync then treats this device's records as wanted:
 * it uploads the ones the cloud lacks and lifts their tombstones, instead of deleting a
 * restored record again because it had been deleted before.
 */
export function markRestorePending() {
  if (!isCloudEnabled()) return
  localStorage.setItem(RESTORE_PENDING_KEY, 'true')
}

/**
 * Deletes every row this user owns in Supabase and drops any queued retries, for a full
 * "delete all my data" reset. Each row leaves a tombstone behind so the user's other
 * devices clear their copies too, rather than keeping (and later re-uploading) them.
 * Throws if any table fails, so the caller can stop before wiping the local copy and
 * leave the two in step.
 */
export async function deleteAllCloudData(userId: string) {
  if (!isCloudEnabled()) return
  const supabase = getSupabase()!
  const deletedAt = Date.now()
  for (const tableName of TABLE_NAMES) {
    const rows = await fetchAll<{ id: string }>(tableName, 'id', 'id', userId)
    // `null`: the table was never created, so there is nothing to delete.
    if (!rows) continue
    await writeTombstones(
      userId,
      tableName,
      rows.map((row) => row.id),
      deletedAt
    )
    const { error } = await supabase.from(tableName).delete().eq('user_id', userId)
    if (error) throw error
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
