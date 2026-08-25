/**
 * Unit tests for the bodyWeight store: upsert-by-date logging, deletion, and loading.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBodyWeightStore } from './bodyWeight'

vi.mock('@/services/storage', () => ({
  storageService: {
    saveExercise: vi.fn(async () => {}),
    getExercise: vi.fn(async () => undefined),
    getAllExercises: vi.fn(async () => []),
    deleteExercise: vi.fn(async () => {}),
    saveRoutine: vi.fn(async () => {}),
    getAllRoutines: vi.fn(async () => []),
    deleteRoutine: vi.fn(async () => {}),
    saveWorkoutSession: vi.fn(async () => {}),
    getWorkoutSession: vi.fn(async () => undefined),
    getWorkoutSessionByDate: vi.fn(async () => undefined),
    getAllWorkoutSessions: vi.fn(async () => []),
    deleteWorkoutSession: vi.fn(async () => {}),
    saveBodyWeightLog: vi.fn(async () => {}),
    getAllBodyWeightLogs: vi.fn(async () => []),
    deleteBodyWeightLog: vi.fn(async () => {}),
    clearAllData: vi.fn(async () => {}),
  },
}))

const INITIAL_STATE = useBodyWeightStore.getState()

describe('useBodyWeightStore', () => {
  beforeEach(() => {
    useBodyWeightStore.setState(INITIAL_STATE, true)
  })

  it('logs a new entry for a date that has never been logged', async () => {
    const entry = await useBodyWeightStore.getState().logWeight('2025-01-06', 75)

    expect(useBodyWeightStore.getState().logs).toHaveLength(1)
    expect(entry.date).toBe('2025-01-06')
    expect(entry.weightKg).toBe(75)
  })

  it('overwrites the existing entry when logging again on the same date', async () => {
    const { logWeight } = useBodyWeightStore.getState()
    const first = await logWeight('2025-01-06', 75)
    const second = await logWeight('2025-01-06', 76.5)

    expect(useBodyWeightStore.getState().logs).toHaveLength(1)
    expect(second.id).toBe(first.id)
    expect(useBodyWeightStore.getState().logByDate('2025-01-06')?.weightKg).toBe(76.5)
  })

  it('keeps separate entries for different dates', async () => {
    const { logWeight } = useBodyWeightStore.getState()
    await logWeight('2025-01-06', 75)
    await logWeight('2025-01-07', 74.8)

    expect(useBodyWeightStore.getState().logs).toHaveLength(2)
  })

  it('allLogs returns entries sorted oldest-first regardless of log order', async () => {
    const { logWeight, allLogs } = useBodyWeightStore.getState()
    await logWeight('2025-01-13', 74)
    await logWeight('2025-01-06', 75)

    expect(allLogs().map((l) => l.date)).toEqual(['2025-01-06', '2025-01-13'])
  })

  it('deletes a log entry', async () => {
    const { logWeight, deleteLog } = useBodyWeightStore.getState()
    const entry = await logWeight('2025-01-06', 75)
    await deleteLog(entry.id)

    expect(useBodyWeightStore.getState().logs).toHaveLength(0)
  })

  it('loadLogs replaces state with storage contents', async () => {
    const { logWeight, loadLogs } = useBodyWeightStore.getState()
    await logWeight('2025-01-06', 75)

    await loadLogs() // mocked storage returns [] — should clear local state
    expect(useBodyWeightStore.getState().logs).toHaveLength(0)
  })
})
