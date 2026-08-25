import { create } from 'zustand'
import type { BodyWeightLog } from '@/types'
import { storageService } from '@/services/storage'
import { useAuthStore } from './auth'
import { syncUpsertBodyWeightLog, syncDeleteBodyWeightLog } from '@/services/cloudSync'

interface BodyWeightState {
  logs: BodyWeightLog[]
  loading: boolean
  error: string | null

  /** All logged entries, oldest first. */
  allLogs: () => BodyWeightLog[]
  logByDate: (date: string) => BodyWeightLog | undefined
  logWeight: (date: string, weightKg: number) => Promise<BodyWeightLog>
  deleteLog: (id: string) => Promise<void>
  loadLogs: () => Promise<void>
}

/**
 * Zustand store for the body weight log — separate from workout performance data.
 */
export const useBodyWeightStore = create<BodyWeightState>()((set, get) => ({
  logs: [],
  loading: false,
  error: null,

  allLogs: () => [...get().logs].sort((a, b) => a.date.localeCompare(b.date)),

  logByDate: (date) => get().logs.find((l) => l.date === date),

  /**
   * Logs (or overwrites) the body weight entry for a given date. Logging again on an
   * already-logged date replaces that entry.
   */
  logWeight: async (date, weightKg) => {
    set({ loading: true, error: null })
    try {
      const existing = get().logs.find((l) => l.date === date)
      const entry: BodyWeightLog = {
        id: existing ? existing.id : crypto.randomUUID(),
        date,
        weightKg,
        createdAt: existing ? existing.createdAt : Date.now(),
        updatedAt: Date.now(),
      }

      set((state) => ({
        logs: existing ? state.logs.map((l) => (l.id === entry.id ? entry : l)) : [...state.logs, entry],
      }))
      await storageService.saveBodyWeightLog(entry)

      const authUser = useAuthStore.getState().user
      if (authUser) syncUpsertBodyWeightLog(authUser.id, entry)

      return entry
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to log body weight' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  deleteLog: async (id) => {
    set({ loading: true, error: null })
    try {
      set((state) => ({ logs: state.logs.filter((l) => l.id !== id) }))
      await storageService.deleteBodyWeightLog(id)

      const authUser = useAuthStore.getState().user
      if (authUser) syncDeleteBodyWeightLog(authUser.id, id)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete body weight log' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  loadLogs: async () => {
    set({ loading: true, error: null })
    try {
      const loaded = await storageService.getAllBodyWeightLogs()
      set({ logs: loaded })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load body weight logs' })
      throw err
    } finally {
      set({ loading: false })
    }
  },
}))
