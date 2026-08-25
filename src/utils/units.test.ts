import { describe, it, expect } from 'vitest'
import { kgToLb, lbToKg, fromKg, toKg, formatWeight } from './units'

describe('kgToLb / lbToKg', () => {
  it('round-trips a value through both conversions', () => {
    expect(lbToKg(kgToLb(75))).toBeCloseTo(75, 5)
  })

  it('converts a known value correctly', () => {
    expect(kgToLb(1)).toBeCloseTo(2.20462, 4)
  })
})

describe('fromKg / toKg', () => {
  it('passes kg values through unchanged when the unit is kg', () => {
    expect(fromKg(75, 'kg')).toBe(75)
    expect(toKg(75, 'kg')).toBe(75)
  })

  it('converts kg to lb for display and back for storage', () => {
    const displayed = fromKg(75, 'lb')!
    expect(displayed).toBeCloseTo(165.3, 1)
    expect(toKg(displayed, 'lb')).toBeCloseTo(75, 5)
  })

  it('propagates null/undefined instead of throwing', () => {
    expect(fromKg(null, 'kg')).toBeNull()
    expect(fromKg(undefined, 'lb')).toBeNull()
    expect(toKg(null, 'kg')).toBeNull()
  })
})

describe('formatWeight', () => {
  it('formats a whole number without decimals', () => {
    expect(formatWeight(60, 'kg')).toBe('60')
  })

  it('formats a fractional value to one decimal place', () => {
    expect(formatWeight(75, 'lb')).toBe('165.3')
  })

  it('returns an empty string for null/undefined', () => {
    expect(formatWeight(null, 'kg')).toBe('')
    expect(formatWeight(undefined, 'kg')).toBe('')
  })
})
