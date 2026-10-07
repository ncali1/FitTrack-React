/**
 * Rest timer store: the countdown is derived from a wall-clock end timestamp, so it has
 * to stay correct when timers are throttled/suspended (app backgrounded, phone locked).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useRestTimerStore } from './restTimer'

describe('Rest timer store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'))
  })

  afterEach(() => {
    useRestTimerStore.getState().stop()
    vi.useRealTimers()
  })

  it('counts down in step with the clock', () => {
    useRestTimerStore.getState().start(90)
    expect(useRestTimerStore.getState()).toMatchObject({ active: true, remaining: 90, duration: 90 })

    vi.advanceTimersByTime(30_000)
    expect(useRestTimerStore.getState().remaining).toBe(60)
  })

  it('catches up after being suspended in the background', () => {
    useRestTimerStore.getState().start(90)

    // The clock moves on a minute but no timer callbacks ran (suspended page)...
    vi.setSystemTime(Date.now() + 60_000)
    expect(useRestTimerStore.getState().remaining).toBe(90)

    // ...until the app is visible again.
    document.dispatchEvent(new Event('visibilitychange'))
    expect(useRestTimerStore.getState().remaining).toBe(30)
  })

  it('finishes immediately on return if the rest ended while suspended', () => {
    useRestTimerStore.getState().start(90)

    vi.setSystemTime(Date.now() + 5 * 60_000)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(useRestTimerStore.getState()).toMatchObject({ active: false, remaining: 0, endsAt: null })
  })

  it('deactivates when the countdown reaches zero', () => {
    useRestTimerStore.getState().start(5)
    vi.advanceTimersByTime(5_000)
    expect(useRestTimerStore.getState()).toMatchObject({ active: false, remaining: 0 })
  })

  it('adjusts the time remaining, never below zero', () => {
    useRestTimerStore.getState().start(60)

    useRestTimerStore.getState().adjust(15)
    expect(useRestTimerStore.getState().remaining).toBe(75)

    useRestTimerStore.getState().adjust(-15)
    expect(useRestTimerStore.getState().remaining).toBe(60)

    useRestTimerStore.getState().adjust(-600)
    expect(useRestTimerStore.getState()).toMatchObject({ active: false, remaining: 0 })
  })

  it('stops early when skipped', () => {
    useRestTimerStore.getState().start(60)
    useRestTimerStore.getState().stop()

    vi.advanceTimersByTime(60_000)
    expect(useRestTimerStore.getState()).toMatchObject({ active: false, remaining: 0, endsAt: null })
  })
})
