import { create } from 'zustand'
import { armRestAlert, disarmRestAlert, fireRestAlert } from '@/services/restAlert'

interface RestTimerState {
  active: boolean
  remaining: number
  duration: number
  /** Unix milliseconds at which the current rest ends; `null` when no timer is running. */
  endsAt: number | null

  /** Starts (or restarts) the countdown from the given duration in seconds. */
  start: (seconds: number) => void
  /** Cancels the timer early (user tapped "Skip"). */
  stop: () => void
  /** Adds (or subtracts) seconds from the time remaining, never going below zero. */
  adjust: (delta: number) => void
}

/** Faster than once a second so the displayed number never lags the wall clock by much. */
const TICK_MS = 250

let intervalId: ReturnType<typeof setInterval> | undefined
let visibilityListenerInstalled = false

function clearTick() {
  if (intervalId !== undefined) {
    clearInterval(intervalId)
    intervalId = undefined
  }
}

/** Whole seconds left until `endsAt`, rounded up so the display only hits 0 at the end. */
export function secondsUntil(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
}

/**
 * Global rest-timer countdown, lives in a module-level Zustand store (not component
 * state) so the countdown keeps running even if the user switches tabs while resting —
 * any mounted RestTimer widget just renders whatever state is here.
 *
 * The source of truth is the `endsAt` timestamp, not a per-tick decrement: browsers
 * throttle or suspend timers while the app is backgrounded or the phone is locked, so
 * `remaining` is always recomputed from the wall clock (on each tick and again the
 * moment the app becomes visible) rather than counted down.
 */
export const useRestTimerStore = create<RestTimerState>()((set, get) => {
  const tick = () => {
    const { endsAt, remaining: previous } = get()
    if (endsAt === null) return

    const remaining = secondsUntil(endsAt)
    if (remaining <= 0) {
      clearTick()
      set({ active: false, remaining: 0, endsAt: null })
      fireRestAlert()
    } else if (remaining !== previous) {
      set({ remaining })
    }
  }

  return {
    active: false,
    remaining: 0,
    duration: 90,
    endsAt: null,

    start: (seconds) => {
      clearTick()
      const endsAt = Date.now() + seconds * 1000
      set({ duration: seconds, remaining: seconds, active: true, endsAt })
      armRestAlert(endsAt)

      intervalId = setInterval(tick, TICK_MS)
      if (!visibilityListenerInstalled && typeof document !== 'undefined') {
        visibilityListenerInstalled = true
        document.addEventListener('visibilitychange', tick)
      }
    },

    stop: () => {
      clearTick()
      set({ active: false, remaining: 0, endsAt: null })
      disarmRestAlert()
    },

    adjust: (delta) => {
      const { endsAt } = get()
      if (endsAt === null) return
      const adjusted = Math.max(Date.now(), endsAt + delta * 1000)
      set({ endsAt: adjusted })
      armRestAlert(adjusted)
      tick()
    },
  }
})
