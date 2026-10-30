import { create } from 'zustand'
import type { CardioSession } from '@/types'
import { storageService } from '@/services/storage'
import { useAuthStore } from './auth'
import { syncUpsertCardioSession, syncDeleteCardioSession } from '@/services/cloudSync'

/** The editable fields of a session — everything but its id and timestamps. */
export type CardioSessionInput = Omit<CardioSession, 'id' | 'createdAt' | 'updatedAt'>

interface CardioState {
  sessions: CardioSession[]
  error: string | null

  /** Logs a new session, or updates the one with `id` when given. */
  saveSession: (input: CardioSessionInput, id?: string) => Promise<CardioSession>
  deleteSession: (id: string) => Promise<void>
  loadSessions: () => Promise<void>
}

/** Drops empty optional fields so stored records only carry what was actually entered. */
function clean(input: CardioSessionInput): CardioSessionInput {
  const notes = input.notes?.trim()
  return {
    date: input.date,
    type: input.type,
    durationSeconds: Math.round(input.durationSeconds),
    ...(input.distanceKm ? { distanceKm: input.distanceKm } : {}),
    ...(input.avgHeartRate ? { avgHeartRate: Math.round(input.avgHeartRate) } : {}),
    ...(input.calories ? { calories: Math.round(input.calories) } : {}),
    ...(notes ? { notes } : {}),
  }
}

/** Zustand store for logged cardio sessions, backed by IndexedDB and synced like the rest. */
export const useCardioStore = create<CardioState>()((set, get) => ({
  sessions: [],
  error: null,

  saveSession: async (input, id) => {
    set({ error: null })
    try {
      const existing = id ? get().sessions.find((s) => s.id === id) : undefined
      const now = Date.now()
      const session: CardioSession = {
        ...clean(input),
        id: existing?.id ?? crypto.randomUUID(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }

      set((state) => ({
        sessions: existing
          ? state.sessions.map((s) => (s.id === session.id ? session : s))
          : [...state.sessions, session],
      }))
      await storageService.saveCardioSession(session)

      const authUser = useAuthStore.getState().user
      if (authUser) syncUpsertCardioSession(authUser.id, session)

      return session
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to save cardio session' })
      throw err
    }
  },

  deleteSession: async (id) => {
    set({ error: null })
    try {
      set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }))
      await storageService.deleteCardioSession(id)

      const authUser = useAuthStore.getState().user
      if (authUser) syncDeleteCardioSession(authUser.id, id)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete cardio session' })
      throw err
    }
  },

  loadSessions: async () => {
    set({ error: null })
    try {
      set({ sessions: await storageService.getAllCardioSessions() })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load cardio sessions' })
      throw err
    }
  },
}))
