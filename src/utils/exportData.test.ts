import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildBackup, downloadBackup, readBackupFile, restoreBackup, InvalidBackupError, BACKUP_VERSION } from './exportData'
import { createMockExercise, createMockRoutine, createMockWorkoutSession } from '@/tests/factories'
import type { BodyWeightLog } from '@/types'

vi.mock('@/services/storage', () => ({
  storageService: {
    saveExercise: vi.fn(async () => {}),
    getAllExercises: vi.fn(async () => []),
    saveRoutine: vi.fn(async () => {}),
    getAllRoutines: vi.fn(async () => []),
    saveWorkoutSession: vi.fn(async () => {}),
    getAllWorkoutSessions: vi.fn(async () => []),
    saveBodyWeightLog: vi.fn(async () => {}),
    getAllBodyWeightLogs: vi.fn(async () => []),
  },
}))

import { storageService } from '@/services/storage'

const mockedStorage = vi.mocked(storageService)

function createMockBodyWeightLog(overrides?: Partial<BodyWeightLog>): BodyWeightLog {
  return {
    id: crypto.randomUUID(),
    date: '2026-01-01',
    weightKg: 80,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeFile(contents: string, name = 'backup.json'): File {
  return new File([contents], name, { type: 'application/json' })
}

describe('exportData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedStorage.getAllExercises.mockResolvedValue([])
    mockedStorage.getAllRoutines.mockResolvedValue([])
    mockedStorage.getAllWorkoutSessions.mockResolvedValue([])
    mockedStorage.getAllBodyWeightLogs.mockResolvedValue([])
  })

  describe('buildBackup', () => {
    it('gathers all record types with a version and ISO exportedAt timestamp', async () => {
      const exercise = createMockExercise()
      const routine = createMockRoutine()
      const session = createMockWorkoutSession()
      const log = createMockBodyWeightLog()

      mockedStorage.getAllExercises.mockResolvedValue([exercise])
      mockedStorage.getAllRoutines.mockResolvedValue([routine])
      mockedStorage.getAllWorkoutSessions.mockResolvedValue([session])
      mockedStorage.getAllBodyWeightLogs.mockResolvedValue([log])

      const backup = await buildBackup()

      expect(backup.version).toBe(BACKUP_VERSION)
      expect(() => new Date(backup.exportedAt).toISOString()).not.toThrow()
      expect(new Date(backup.exportedAt).toISOString()).toBe(backup.exportedAt)
      expect(backup.exercises).toEqual([exercise])
      expect(backup.routines).toEqual([routine])
      expect(backup.workoutSessions).toEqual([session])
      expect(backup.bodyWeightLogs).toEqual([log])
    })

    it('produces an empty backup when nothing is stored', async () => {
      const backup = await buildBackup()

      expect(backup.exercises).toEqual([])
      expect(backup.routines).toEqual([])
      expect(backup.workoutSessions).toEqual([])
      expect(backup.bodyWeightLogs).toEqual([])
    })
  })

  describe('downloadBackup', () => {
    it('triggers a browser download named fittrack-backup-YYYY-MM-DD.json', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 7, 23))

      const createObjectURL = vi.fn(() => 'blob:mock-url')
      const revokeObjectURL = vi.fn()
      vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      await downloadBackup()

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

      clickSpy.mockRestore()
      vi.unstubAllGlobals()
      vi.useRealTimers()
    })
  })

  describe('readBackupFile', () => {
    it('throws InvalidBackupError for malformed JSON', async () => {
      const file = makeFile('{not valid json')
      await expect(readBackupFile(file)).rejects.toThrow(InvalidBackupError)
    })

    it('throws InvalidBackupError when required fields are missing', async () => {
      const file = makeFile(JSON.stringify({ exercises: [] }))
      await expect(readBackupFile(file)).rejects.toThrow(InvalidBackupError)
    })

    it('throws InvalidBackupError when a record field is not an array', async () => {
      const file = makeFile(
        JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          exercises: 'not-an-array',
          routines: [],
          workoutSessions: [],
          bodyWeightLogs: [],
        })
      )
      await expect(readBackupFile(file)).rejects.toThrow(InvalidBackupError)
    })

    it('parses a valid backup file', async () => {
      const exercise = createMockExercise()
      const backupJson = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        exercises: [exercise],
        routines: [],
        workoutSessions: [],
        bodyWeightLogs: [],
      }
      const file = makeFile(JSON.stringify(backupJson))

      const result = await readBackupFile(file)

      expect(result).toEqual(backupJson)
    })

    it('parses a valid, empty backup file', async () => {
      const backupJson = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        exercises: [],
        routines: [],
        workoutSessions: [],
        bodyWeightLogs: [],
      }
      const file = makeFile(JSON.stringify(backupJson))

      const result = await readBackupFile(file)

      expect(result).toEqual(backupJson)
    })
  })

  describe('restoreBackup', () => {
    it('upserts every record via storageService and returns accurate counts', async () => {
      const exercise = createMockExercise()
      const routine = createMockRoutine()
      const session = createMockWorkoutSession()
      const log = createMockBodyWeightLog()

      const counts = await restoreBackup({
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        exercises: [exercise],
        routines: [routine],
        workoutSessions: [session],
        bodyWeightLogs: [log],
      })

      expect(mockedStorage.saveExercise).toHaveBeenCalledWith(exercise)
      expect(mockedStorage.saveRoutine).toHaveBeenCalledWith(routine)
      expect(mockedStorage.saveWorkoutSession).toHaveBeenCalledWith(session)
      expect(mockedStorage.saveBodyWeightLog).toHaveBeenCalledWith(log)

      expect(counts).toEqual({ exercises: 1, routines: 1, workoutSessions: 1, bodyWeightLogs: 1 })
    })

    it('returns all-zero counts and writes nothing for an empty backup', async () => {
      const counts = await restoreBackup({
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        exercises: [],
        routines: [],
        workoutSessions: [],
        bodyWeightLogs: [],
      })

      expect(counts).toEqual({ exercises: 0, routines: 0, workoutSessions: 0, bodyWeightLogs: 0 })
      expect(mockedStorage.saveExercise).not.toHaveBeenCalled()
      expect(mockedStorage.saveRoutine).not.toHaveBeenCalled()
      expect(mockedStorage.saveWorkoutSession).not.toHaveBeenCalled()
      expect(mockedStorage.saveBodyWeightLog).not.toHaveBeenCalled()
    })

    it('overwrites a record with a matching id rather than duplicating it', async () => {
      const exercise = createMockExercise({ id: 'exercise-1', name: 'Updated Name' })

      await restoreBackup({
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        exercises: [exercise],
        routines: [],
        workoutSessions: [],
        bodyWeightLogs: [],
      })

      expect(mockedStorage.saveExercise).toHaveBeenCalledTimes(1)
      expect(mockedStorage.saveExercise).toHaveBeenCalledWith(expect.objectContaining({ id: 'exercise-1', name: 'Updated Name' }))
    })
  })
})
