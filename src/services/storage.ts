import { db } from './database'
import type { Exercise, Routine, WorkoutSession, BodyWeightLog } from '@/types'

const MAX_RETRIES = 3
const RETRY_DELAYS = [100, 500, 1000]

/**
 * Deep-clones a value into a plain, structured-clone-safe object via a JSON
 * round-trip. Safe here because Exercise, Routine, WorkoutSession, and
 * BodyWeightLog are plain data (strings, numbers, arrays, nested plain
 * objects) with no functions, Dates, or circular references.
 */
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Thrown when IndexedDB storage quota is exceeded.
 * Callers should notify the user to free space — retrying will not help.
 */
export class StorageQuotaError extends Error {
  constructor(message = 'Storage limit reached. Please delete old data or clear browser cache') {
    super(message)
    this.name = 'StorageQuotaError'
  }
}

/**
 * Returns true when the given error represents a browser storage-quota violation.
 */
function isQuotaError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.name === 'QuotaExceededError' || err.message.toLowerCase().includes('quota')
  }
  return false
}

/**
 * Retries an async operation up to MAX_RETRIES times with exponential back-off.
 * Quota errors are re-thrown immediately without retrying.
 */
async function retryOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await operation()
    } catch (err) {
      if (isQuotaError(err)) {
        throw new StorageQuotaError()
      }

      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS[attempt]
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw new Error(`${operationName} failed after ${MAX_RETRIES} attempts: ${lastError?.message}`)
}

/**
 * Provides CRUD operations for exercises, routines, workout sessions, and body
 * weight logs backed by IndexedDB (via Dexie). All methods automatically retry
 * transient failures with exponential back-off and throw {@link StorageQuotaError}
 * on quota violations.
 */
export const storageService = {
  // ── Exercise operations ───────────────────────────────────────────────────

  async saveExercise(exercise: Exercise): Promise<void> {
    return retryOperation(() => db.exercises.put(toPlain(exercise)), 'Save exercise').then(() => {})
  },

  async getExercise(id: string): Promise<Exercise | undefined> {
    return retryOperation(() => db.exercises.get(id), 'Get exercise')
  },

  async getAllExercises(): Promise<Exercise[]> {
    return retryOperation(() => db.exercises.toArray(), 'Get all exercises')
  },

  async deleteExercise(id: string): Promise<void> {
    return retryOperation(() => db.exercises.delete(id), 'Delete exercise').then(() => {})
  },

  // ── Routine operations ────────────────────────────────────────────────────

  async saveRoutine(routine: Routine): Promise<void> {
    return retryOperation(() => db.routine.put(toPlain(routine)), 'Save routine').then(() => {})
  },

  async getAllRoutines(): Promise<Routine[]> {
    return retryOperation(() => db.routine.toArray(), 'Get all routines')
  },

  async deleteRoutine(id: string): Promise<void> {
    return retryOperation(() => db.routine.delete(id), 'Delete routine').then(() => {})
  },

  // ── Workout session operations ────────────────────────────────────────────

  async saveWorkoutSession(session: WorkoutSession): Promise<void> {
    return retryOperation(() => db.workoutSessions.put(toPlain(session)), 'Save workout session').then(() => {})
  },

  async getWorkoutSession(id: string): Promise<WorkoutSession | undefined> {
    return retryOperation(() => db.workoutSessions.get(id), 'Get workout session')
  },

  async getWorkoutSessionByDate(date: string): Promise<WorkoutSession | undefined> {
    return retryOperation(
      () => db.workoutSessions.where('date').equals(date).first(),
      'Get workout session by date'
    )
  },

  async getAllWorkoutSessions(): Promise<WorkoutSession[]> {
    return retryOperation(() => db.workoutSessions.toArray(), 'Get all workout sessions')
  },

  async deleteWorkoutSession(id: string): Promise<void> {
    return retryOperation(() => db.workoutSessions.delete(id), 'Delete workout session').then(() => {})
  },

  // ── Body weight log operations ────────────────────────────────────────────

  /**
   * Persists a body weight log entry to IndexedDB. Logging again on the same date
   * overwrites that date's entry rather than creating a duplicate.
   */
  async saveBodyWeightLog(log: BodyWeightLog): Promise<void> {
    return retryOperation(async () => {
      const existing = await db.bodyWeightLogs.where('date').equals(log.date).first()
      const plain = toPlain(existing ? { ...log, id: existing.id } : log)
      await db.bodyWeightLogs.put(plain)
    }, 'Save body weight log').then(() => {})
  },

  async getAllBodyWeightLogs(): Promise<BodyWeightLog[]> {
    return retryOperation(() => db.bodyWeightLogs.toArray(), 'Get all body weight logs')
  },

  async deleteBodyWeightLog(id: string): Promise<void> {
    return retryOperation(() => db.bodyWeightLogs.delete(id), 'Delete body weight log').then(() => {})
  },

  // ── Bulk operations ───────────────────────────────────────────────────────

  /**
   * Deletes all exercises, routines, workout sessions, and body weight logs from
   * IndexedDB. Intended for use in tests or when the user requests a full data reset.
   */
  async clearAllData(): Promise<void> {
    return retryOperation(async () => {
      await db.exercises.clear()
      await db.routine.clear()
      await db.workoutSessions.clear()
      await db.bodyWeightLogs.clear()
    }, 'Clear all data').then(() => {})
  },
}
