import { create } from 'zustand'

interface RestTimerState {
  active: boolean
  remaining: number
  duration: number

  /** Starts (or restarts) the countdown from the given duration in seconds. */
  start: (seconds: number) => void
  /** Cancels the timer early (user tapped "Skip"). */
  stop: () => void
  /** Adds (or subtracts) seconds from the time remaining, never going below zero. */
  adjust: (delta: number) => void
}

let intervalId: ReturnType<typeof setInterval> | undefined

function clearTick() {
  if (intervalId !== undefined) {
    clearInterval(intervalId)
    intervalId = undefined
  }
}

/**
 * Global rest-timer countdown, lives in a module-level Zustand store (not component
 * state) so the countdown keeps running even if the user switches tabs while resting —
 * any mounted RestTimer widget just renders whatever state is here.
 */
export const useRestTimerStore = create<RestTimerState>()((set, get) => ({
  active: false,
  remaining: 0,
  duration: 90,

  start: (seconds) => {
    clearTick()
    set({ duration: seconds, remaining: seconds, active: true })

    intervalId = setInterval(() => {
      const remaining = get().remaining - 1
      if (remaining <= 0) {
        clearTick()
        set({ active: false, remaining: 0 })
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([200, 100, 200])
        }
      } else {
        set({ remaining })
      }
    }, 1000)
  },

  stop: () => {
    clearTick()
    set({ active: false, remaining: 0 })
  },

  adjust: (delta) => set((state) => ({ remaining: Math.max(0, state.remaining + delta) })),
}))
