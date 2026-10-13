import Dexie, { type Table } from 'dexie'
import type { Exercise, Routine, WorkoutTemplate, WorkoutSession, BodyWeightLog } from '@/types'

/**
 * Dexie (IndexedDB) database for the Fitness Tracker application.
 *
 * Tables:
 * - `exercises`      — all user-defined exercises
 * - `routine`        — saved weekly programs, indexed by `isActive`
 * - `workoutTemplates` — reusable named exercise lists ("routines" in the UI)
 * - `workoutSessions`— daily workout sessions, indexed by `date`
 * - `bodyWeightLogs` — daily body weight log entries, indexed by `date`
 */
export class FitnessTrackerDB extends Dexie {
  exercises!: Table<Exercise>
  routine!: Table<Routine>
  workoutTemplates!: Table<WorkoutTemplate>
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
    this.version(2).stores({
      workoutTemplates: '++id',
    })
  }
}

/** Singleton database instance shared across the application. */
export const db = new FitnessTrackerDB()
