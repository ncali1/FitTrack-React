import { describe, it, expect } from 'vitest'
import { calculatePlateLoading, formatPlateBreakdown } from './plateCalculator'

describe('calculatePlateLoading', () => {
  it('loads a weight exactly matching the bar with no plates', () => {
    expect(calculatePlateLoading(20, 'kg')).toEqual({ barWeight: 20, platesPerSide: [], leftoverPerSide: 0 })
  })

  it('never goes below the bar weight for a target under it', () => {
    expect(calculatePlateLoading(10, 'kg')).toEqual({ barWeight: 20, platesPerSide: [], leftoverPerSide: 0 })
  })

  it('greedily picks the largest plates first (kg)', () => {
    // 60kg = 20kg bar + 20kg per side
    expect(calculatePlateLoading(60, 'kg')).toEqual({ barWeight: 20, platesPerSide: [20], leftoverPerSide: 0 })
  })

  it('combines multiple plate sizes per side (kg)', () => {
    // 100kg = 20kg bar + 40kg per side -> 25 + 15 per side
    expect(calculatePlateLoading(100, 'kg')).toEqual({ barWeight: 20, platesPerSide: [25, 15], leftoverPerSide: 0 })
  })

  it('reports leftover when the exact weight cannot be made with available plates', () => {
    // 21.5kg -> 0.75kg per side, smaller than the smallest 1.25kg plate
    const result = calculatePlateLoading(21.5, 'kg')
    expect(result.platesPerSide).toEqual([])
    expect(result.leftoverPerSide).toBeCloseTo(0.75, 2)
  })

  it('uses the 45lb bar and lb plate set when unit is lb', () => {
    // 135lb = 45lb bar + 45lb per side -> one 45lb plate per side
    expect(calculatePlateLoading(135, 'lb')).toEqual({ barWeight: 45, platesPerSide: [45], leftoverPerSide: 0 })
  })
})

describe('formatPlateBreakdown', () => {
  it('says "just the bar" when no plates are needed', () => {
    expect(formatPlateBreakdown(calculatePlateLoading(20, 'kg'), 'kg')).toBe('Just the bar (20kg)')
  })

  it('lists a single plate per side', () => {
    expect(formatPlateBreakdown(calculatePlateLoading(60, 'kg'), 'kg')).toBe('20kg bar + 20 per side')
  })

  it('groups repeated equal plates with a × count, without merging distinct sizes that share a leading digit', () => {
    // 100kg -> [25, 15] per side, not grouped since they're different values
    expect(formatPlateBreakdown(calculatePlateLoading(100, 'kg'), 'kg')).toBe('20kg bar + 25, 15 per side')
    // 140kg -> 60kg per side -> [25, 25, 10] -> "25×2, 10"
    expect(formatPlateBreakdown(calculatePlateLoading(140, 'kg'), 'kg')).toBe('20kg bar + 25×2, 10 per side')
  })

  it('reports a short-per-side leftover when the exact weight is unreachable', () => {
    expect(formatPlateBreakdown(calculatePlateLoading(21.5, 'kg'), 'kg')).toBe(
      'Just the bar (20kg) (+0.75kg short per side)'
    )
  })
})
