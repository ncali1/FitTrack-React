import Dexie, { type Table } from 'dexie'
import type { Exercise, Routine, WorkoutSession, BodyWeightLog } from '@/types'

/**
 * Dexie (IndexedDB) database for the Fitness Tracker application.
 *
 * Tables:
 * - `exercises`      — all user-defined exercises
 * - `routine`        — saved routines/programs, indexed by `isActive`
 * - `workoutSessions`— daily workout sessions, indexed by `date`
 * - `bodyWeightLogs` — daily body weight log entries, indexed by `date`
 */
export class FitnessTrackerDB extends Dexie {
  exercises!: Table<Exercise>
  routine!: Table<Routine>
  workoutSessions!: Table<WorkoutSession>
  bodyWeightLogs!: Table<BodyWeightLog>

  constructor() {
    super('FitnessTrackerDB')
    this.version(1).stores({
      exercises: '++id',
      routine: '++id, isActive',
      workoutSessions: '++id, date',
      bodyWeightLogs: '++id, date',
    })
  }
}

/** Singleton database instance shared across the application. */
export const db = new FitnessTrackerDB()
