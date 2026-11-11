import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useGuidedSessionStore } from './guidedSession'

const STORAGE_KEY = 'fittrack-guided-session'
const store = () => useGuidedSessionStore.getState()

describe('guidedSession store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15, 18, 0))
    store().end()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts at the first exercise, stamped with the date and start time', () => {
    store().start('2026-01-15', [['a', 'b'], ['c']])

    expect(store().session).toEqual({
      date: '2026-01-15',
      startedAt: Date.now(),
      groups: [['a', 'b'], ['c']],
      groupIndex: 0,
      exerciseIndex: 0,
      restEndsAt: null,
    })
  })

  it('advances through a superset before moving to the next group', () => {
    store().start('2026-01-15', [['a', 'b'], ['c']])

    store().advance()
    expect(store().session).toMatchObject({ groupIndex: 0, exerciseIndex: 1 })

    store().advance()
    expect(store().session).toMatchObject({ groupIndex: 1, exerciseIndex: 0 })
  })

  it('ends the rest when it advances', () => {
    store().start('2026-01-15', [['a'], ['b']])
    store().startRest(Date.now() + 90_000)
    expect(store().session?.restEndsAt).toBe(Date.now() + 90_000)

    store().advance()

    expect(store().session).toMatchObject({ groupIndex: 1, restEndsAt: null })
  })

  it('swaps an exercise in place without moving the position', () => {
    store().start('2026-01-15', [['a', 'b'], ['c']])
    store().advance()

    store().swap('b', 'z')

    expect(store().session).toMatchObject({ groups: [['a', 'z'], ['c']], groupIndex: 0, exerciseIndex: 1 })
  })

  it('does nothing when there is no session to advance or swap', () => {
    store().advance()
    store().swap('a', 'b')
    store().startRest(1)

    expect(store().session).toBeNull()
  })

  describe('when the app is reopened', () => {
    const saved = (startedAt: number) => ({
      state: {
        session: { date: '2026-01-15', startedAt, groups: [['a'], ['b']], groupIndex: 1, exerciseIndex: 0, restEndsAt: null },
      },
      version: 0,
    })

    it('resumes a workout that was under way', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved(Date.now() - 30 * 60 * 1000)))

      await useGuidedSessionStore.persist.rehydrate()

      expect(store().session).toMatchObject({ date: '2026-01-15', groupIndex: 1 })
    })

    it('abandons a workout left unfinished since yesterday', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved(Date.now() - 20 * 60 * 60 * 1000)))

      await useGuidedSessionStore.persist.rehydrate()

      expect(store().session).toBeNull()
    })
  })
})
