import { describe, it, expect } from 'vitest'
import { activeRegionsFor } from './muscleRegions'
import { MUSCLE_GROUP_OPTIONS } from '@/components/exercises/ExerciseForm'

describe('activeRegionsFor', () => {
  it('maps a simple muscle group to its own region', () => {
    expect(activeRegionsFor(['Chest'])).toEqual(new Set(['chest']))
  })

  it('maps "Legs" to quadriceps, hamstrings, and calves', () => {
    expect(activeRegionsFor(['Legs'])).toEqual(new Set(['quadriceps', 'hamstrings', 'calves']))
  })

  it('unions regions across multiple muscle groups without duplicates', () => {
    const regions = activeRegionsFor(['Chest', 'Triceps', 'Shoulders'])
    expect(regions).toEqual(new Set(['chest', 'triceps', 'shoulders']))
  })

  it('ignores unrecognized muscle group names', () => {
    expect(activeRegionsFor(['Not A Real Muscle'])).toEqual(new Set())
  })

  it('returns an empty set for no muscle groups', () => {
    expect(activeRegionsFor([])).toEqual(new Set())
  })

  it('resolves every recognized muscle group option to at least one region', () => {
    for (const group of MUSCLE_GROUP_OPTIONS) {
      expect(activeRegionsFor([group]).size).toBeGreaterThan(0)
    }
  })
})
