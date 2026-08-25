import { storageService } from '@/services/storage'
import type { Exercise, Routine, WorkoutSession, BodyWeightLog } from '@/types'

/** Bumped whenever the backup shape changes in a way future code needs to branch on. */
export const BACKUP_VERSION = 1

/** A full snapshot of everything storageService holds, suitable for download/restore. */
export interface Backup {
  version: number
  /** ISO timestamp of when this backup was generated. */
  exportedAt: string
  exercises: Exercise[]
  routines: Routine[]
  workoutSessions: WorkoutSession[]
  bodyWeightLogs: BodyWeightLog[]
}

/** Thrown by {@link readBackupFile} when a file's contents don't look like a valid backup. */
export class InvalidBackupError extends Error {
  constructor(message = 'This file is not a valid FitTrack backup') {
    super(message)
    this.name = 'InvalidBackupError'
  }
}

/** How many records of each type {@link restoreBackup} wrote. */
export interface RestoreCounts {
  exercises: number
  routines: number
  workoutSessions: number
  bodyWeightLogs: number
}

/** Gathers everything from storageService into a single, timestamped backup object. */
export async function buildBackup(): Promise<Backup> {
  const [exercises, routines, workoutSessions, bodyWeightLogs] = await Promise.all([
    storageService.getAllExercises(),
    storageService.getAllRoutines(),
    storageService.getAllWorkoutSessions(),
    storageService.getAllBodyWeightLogs(),
  ])

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    exercises,
    routines,
    workoutSessions,
    bodyWeightLogs,
  }
}

function dateStamp(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Builds a backup and triggers a browser download of it as a dated JSON file. */
export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `fittrack-backup-${dateStamp(new Date())}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function isPlainObjectArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null)
}

/** Validates that a parsed JSON value has the shape of a {@link Backup}, throwing otherwise. */
function assertBackupShape(parsed: unknown): asserts parsed is Backup {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidBackupError()
  }

  const candidate = parsed as Record<string, unknown>
  if (typeof candidate.version !== 'number' || typeof candidate.exportedAt !== 'string') {
    throw new InvalidBackupError()
  }
  if (
    !isPlainObjectArray(candidate.exercises) ||
    !isPlainObjectArray(candidate.routines) ||
    !isPlainObjectArray(candidate.workoutSessions) ||
    !isPlainObjectArray(candidate.bodyWeightLogs)
  ) {
    throw new InvalidBackupError()
  }
}

/** Reads and validates a File's JSON contents as a {@link Backup}. Throws {@link InvalidBackupError} otherwise. */
export async function readBackupFile(file: File): Promise<Backup> {
  const text = await file.text()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new InvalidBackupError('File is not valid JSON')
  }

  assertBackupShape(parsed)
  return parsed
}

/**
 * Merges a backup into IndexedDB by upserting each record via storageService — every
 * record's id is put (overwriting a matching existing id) rather than replacing the
 * whole table, so nothing already stored but absent from the backup is ever deleted.
 */
export async function restoreBackup(backup: Backup): Promise<RestoreCounts> {
  await Promise.all(backup.exercises.map((exercise) => storageService.saveExercise(exercise)))
  await Promise.all(backup.routines.map((routine) => storageService.saveRoutine(routine)))
  await Promise.all(backup.workoutSessions.map((session) => storageService.saveWorkoutSession(session)))
  await Promise.all(backup.bodyWeightLogs.map((log) => storageService.saveBodyWeightLog(log)))

  return {
    exercises: backup.exercises.length,
    routines: backup.routines.length,
    workoutSessions: backup.workoutSessions.length,
    bodyWeightLogs: backup.bodyWeightLogs.length,
  }
}
