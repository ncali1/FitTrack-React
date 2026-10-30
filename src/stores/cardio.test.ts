import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCardioStore } from './cardio'

vi.mock('@/services/storage', () => ({
  storageService: {
    saveCardioSession: vi.fn(async () => {}),
    getAllCardioSessions: vi.fn(async () => []),
    deleteCardioSession: vi.fn(async () => {}),
  },
}))

import { storageService } from '@/services/storage'

const mockedStorage = vi.mocked(storageService)
const INITIAL_STATE = useCardioStore.getState()

const run = { date: '2026-10-20', type: 'run' as const, durationSeconds: 1800, distanceKm: 5 }

describe('useCardioStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCardioStore.setState(INITIAL_STATE, true)
  })

  it('logs a session and persists it', async () => {
    const saved = await useCardioStore.getState().saveSession(run)

    expect(saved).toMatchObject(run)
    expect(useCardioStore.getState().sessions).toEqual([saved])
    expect(mockedStorage.saveCardioSession).toHaveBeenCalledWith(saved)
  })

  it('keeps only the optional fields that were filled in', async () => {
    const saved = await useCardioStore.getState().saveSession({
      ...run,
      distanceKm: undefined,
      avgHeartRate: 151.6,
      calories: 0,
      notes: '   ',
    })

    expect(saved).not.toHaveProperty('distanceKm')
    expect(saved).not.toHaveProperty('calories')
    expect(saved).not.toHaveProperty('notes')
    expect(saved.avgHeartRate).toBe(152)
  })

  it('allows several sessions on the same day', async () => {
    await useCardioStore.getState().saveSession(run)
    await useCardioStore.getState().saveSession({ ...run, type: 'walk' })

    expect(useCardioStore.getState().sessions).toHaveLength(2)
  })

  it('updates a session in place, keeping its id and creation time', async () => {
    const original = await useCardioStore.getState().saveSession(run)
    const updated = await useCardioStore.getState().saveSession({ ...run, durationSeconds: 2000 }, original.id)

    expect(updated).toMatchObject({ id: original.id, createdAt: original.createdAt, durationSeconds: 2000 })
    expect(useCardioStore.getState().sessions).toEqual([updated])
  })

  it('deletes a session', async () => {
    const saved = await useCardioStore.getState().saveSession(run)
    await useCardioStore.getState().deleteSession(saved.id)

    expect(useCardioStore.getState().sessions).toEqual([])
    expect(mockedStorage.deleteCardioSession).toHaveBeenCalledWith(saved.id)
  })

  it('records the failure and re-throws when saving fails', async () => {
    mockedStorage.saveCardioSession.mockRejectedValueOnce(new Error('disk full'))

    await expect(useCardioStore.getState().saveSession(run)).rejects.toThrow('disk full')
    expect(useCardioStore.getState().error).toBe('disk full')
  })
})
