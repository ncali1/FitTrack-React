import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** A guided workout in progress: what was planned, and how far through it the user is. */
export interface ActiveGuidedSession {
  /** The `YYYY-MM-DD` date the workout is being logged against. */
  date: string
  /** Unix milliseconds the workout began, for its total duration. */
  startedAt: number
  /** Exercise ids in order; a group with more than one id is a superset. */
  groups: string[][]
  groupIndex: number
  exerciseIndex: number
  /** Unix milliseconds at which the current rest ends; `null` while logging. */
  restEndsAt: number | null
}

interface GuidedSessionState {
  session: ActiveGuidedSession | null

  start: (date: string, groups: string[][]) => void
  /** Begins the rest that follows a finished group. */
  startRest: (endsAt: number) => void
  /** Ends any rest and moves to the next exercise in the group, or the next group's first. */
  advance: () => void
  /** Puts `toId` in every slot `fromId` held. */
  swap: (fromId: string, toId: string) => void
  end: () => void
}

/** A workout left unfinished for longer than this is abandoned, not resumed. */
const STALE_AFTER_MS = 12 * 60 * 60 * 1000

/**
 * Where the user is in a guided workout. Lives in a store, not in the Train tab's
 * component state, because that tab unmounts on every tab switch — checking the Library
 * between sets used to throw the whole session away. It's persisted too, since a phone
 * will happily kill a backgrounded app mid-workout; like preferences it's per-device
 * state, so it stays in localStorage and is never synced or exported.
 */
export const useGuidedSessionStore = create<GuidedSessionState>()(
  persist(
    (set) => ({
      session: null,

      start: (date, groups) =>
        set({ session: { date, startedAt: Date.now(), groups, groupIndex: 0, exerciseIndex: 0, restEndsAt: null } }),

      startRest: (endsAt) => set(({ session }) => ({ session: session && { ...session, restEndsAt: endsAt } })),

      advance: () =>
        set(({ session }) => {
          if (!session) return {}
          const isLastInGroup = session.exerciseIndex >= (session.groups[session.groupIndex]?.length ?? 0) - 1
          return {
            session: {
              ...session,
              restEndsAt: null,
              groupIndex: isLastInGroup ? session.groupIndex + 1 : session.groupIndex,
              exerciseIndex: isLastInGroup ? 0 : session.exerciseIndex + 1,
            },
          }
        }),

      swap: (fromId, toId) =>
        set(({ session }) => ({
          session: session && {
            ...session,
            groups: session.groups.map((group) => group.map((id) => (id === fromId ? toId : id))),
          },
        })),

      end: () => set({ session: null }),
    }),
    {
      name: 'fittrack-guided-session',
      partialize: (state) => ({ session: state.session }),
      merge: (persisted, current) => {
        const saved = (persisted as Partial<GuidedSessionState> | undefined)?.session ?? null
        const fresh = saved !== null && Date.now() - saved.startedAt < STALE_AFTER_MS
        return { ...current, session: fresh ? saved : null }
      },
    }
  )
)
