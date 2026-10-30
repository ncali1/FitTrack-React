import { describe, it, expect } from 'vitest'
import { generateWarmupSets } from './warmupSets'

describe('generateWarmupSets', () => {
  it('ramps from the empty bar through 40/60/80%, rounded down to loadable kg', () => {
    expect(generateWarmupSets(100, 'kg')).toEqual([
      { weight: 20, reps: 10 },
      { weight: 40, reps: 5 },
      { weight: 60, reps: 3 },
      { weight: 80, reps: 2 },
    ])
  })

  it('rounds to 5lb jumps and starts from a 45lb bar in pounds', () => {
    expect(generateWarmupSets(225, 'lb')).toEqual([
      { weight: 45, reps: 10 },
      { weight: 90, reps: 5 },
      { weight: 135, reps: 3 },
      { weight: 180, reps: 2 },
    ])
  })

  it('never rounds a warm-up up past its percentage', () => {
    // 37.2 → 35, 55.8 → 55, 74.4 → 72.5
    expect(generateWarmupSets(93, 'kg').map((s) => s.weight)).toEqual([20, 35, 55, 72.5])
  })

  it('drops ramp sets that would be no heavier than the bar', () => {
    // 40% of 40 = 16 → 15 is below the 20kg bar, so the ramp resumes at 60% (24 → 22.5).
    expect(generateWarmupSets(40, 'kg')).toEqual([
      { weight: 20, reps: 10 },
      { weight: 22.5, reps: 3 },
      { weight: 30, reps: 2 },
    ])
  })

  it('skips the empty bar for working weights at or below it (e.g. dumbbells)', () => {
    expect(generateWarmupSets(15, 'kg')).toEqual([
      { weight: 5, reps: 5 },
      { weight: 7.5, reps: 3 },
      { weight: 10, reps: 2 },
    ])
  })

  it('keeps every warm-up strictly lighter than the working weight and ascending', () => {
    for (const unit of ['kg', 'lb'] as const) {
      for (let working = 1; working <= 300; working += 0.5) {
        const sets = generateWarmupSets(working, unit)
        sets.forEach((s, i) => {
          expect(s.weight).toBeLessThan(working)
          if (i > 0) expect(s.weight).toBeGreaterThan(sets[i - 1].weight)
        })
      }
    }
  })

  it('returns nothing for a zero, negative or missing weight, or one too light to ramp', () => {
    expect(generateWarmupSets(0, 'kg')).toEqual([])
    expect(generateWarmupSets(-10, 'kg')).toEqual([])
    expect(generateWarmupSets(Number.NaN, 'kg')).toEqual([])
    expect(generateWarmupSets(2.5, 'kg')).toEqual([])
  })
})
