import { describe, it, expect } from 'vitest'
import {
  cardioTotals,
  distanceToKm,
  formatDistance,
  formatDuration,
  formatPace,
  formatTotalTime,
  kmToDistance,
  sortCardioNewestFirst,
} from './cardio'
import type { CardioSession } from '@/types'

const session = (overrides: Partial<CardioSession>): CardioSession => ({
  id: crypto.randomUUID(),
  date: '2026-10-20',
  type: 'run',
  durationSeconds: 1800,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
})

describe('cardio helpers', () => {
  it('converts between km and miles in both directions', () => {
    expect(kmToDistance(1.609344, 'mi')).toBeCloseTo(1)
    expect(distanceToKm(1, 'mi')).toBeCloseTo(1.609344)
    expect(kmToDistance(5, 'km')).toBe(5)
    expect(distanceToKm(kmToDistance(7.3, 'mi'), 'mi')).toBeCloseTo(7.3)
  })

  it('formats distances with two decimals under 10 and one above', () => {
    expect(formatDistance(5.123, 'km')).toBe('5.12 km')
    expect(formatDistance(21.0975, 'km')).toBe('21.1 km')
    expect(formatDistance(5, 'mi')).toBe('3.11 mi')
  })

  it('formats durations as m:ss, or h:mm:ss from an hour up', () => {
    expect(formatDuration(45)).toBe('0:45')
    expect(formatDuration(1805)).toBe('30:05')
    expect(formatDuration(3930)).toBe('1:05:30')
    expect(formatTotalTime(3930)).toBe('1h 6m')
    expect(formatTotalTime(1500)).toBe('25m')
  })

  it('gives runs a pace per km or mile', () => {
    expect(formatPace(session({ type: 'run', durationSeconds: 1500, distanceKm: 5 }), 'km')).toBe('5:00 /km')
    expect(formatPace(session({ type: 'run', durationSeconds: 1500, distanceKm: 5 }), 'mi')).toBe('8:03 /mi')
  })

  it('gives rides a speed, rows a /500m split, and swims a /100m split', () => {
    expect(formatPace(session({ type: 'cycle', durationSeconds: 3600, distanceKm: 30 }), 'km')).toBe('30 km/h')
    expect(formatPace(session({ type: 'row', durationSeconds: 480, distanceKm: 2 }), 'km')).toBe('2:00 /500m')
    expect(formatPace(session({ type: 'swim', durationSeconds: 1200, distanceKm: 1 }), 'mi')).toBe('2:00 /100m')
  })

  it('has no pace without a distance, or for types not measured that way', () => {
    expect(formatPace(session({ type: 'run', distanceKm: undefined }), 'km')).toBeNull()
    expect(formatPace(session({ type: 'hiit', distanceKm: 3 }), 'km')).toBeNull()
    expect(formatPace(session({ type: 'run', durationSeconds: 0, distanceKm: 3 }), 'km')).toBeNull()
  })

  it('totals only the sessions inside the date range, inclusive', () => {
    const sessions = [
      session({ date: '2026-10-18', durationSeconds: 999, distanceKm: 99 }),
      session({ date: '2026-10-19', durationSeconds: 1800, distanceKm: 5 }),
      session({ date: '2026-10-25', durationSeconds: 1200 }),
      session({ date: '2026-10-26', durationSeconds: 999 }),
    ]
    expect(cardioTotals(sessions, '2026-10-19', '2026-10-25')).toEqual({
      sessions: 2,
      durationSeconds: 3000,
      distanceKm: 5,
    })
  })

  it('sorts newest first by date, then by when it was logged', () => {
    const a = session({ date: '2026-10-19', createdAt: 5 })
    const b = session({ date: '2026-10-20', createdAt: 1 })
    const c = session({ date: '2026-10-20', createdAt: 2 })
    expect(sortCardioNewestFirst([a, b, c])).toEqual([c, b, a])
  })
})
