import { describe, it, expect } from 'vitest'
import { WORKOUT_LIBRARY } from './workoutLibrary'
import { MUSCLE_GROUP_OPTIONS } from '@/components/exercises/ExerciseForm'
import type { MovementPattern } from '@/utils/muscleRegions'

const KNOWN_PATTERNS: MovementPattern[] = [
  'press',
  'row',
  'raise',
  'curl',
  'bob',
  'lean',
  'bridge',
  'rise',
  'pulse',
  'twist',
]

describe('WORKOUT_LIBRARY', () => {
  it('has at least one workout', () => {
    expect(WORKOUT_LIBRARY.length).toBeGreaterThan(0)
  })

  it('has unique ids', () => {
    const ids = WORKOUT_LIBRARY.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every workout has a non-empty name and description', () => {
    for (const workout of WORKOUT_LIBRARY) {
      expect(workout.name.trim()).not.toBe('')
      expect(workout.description.trim()).not.toBe('')
    }
  })

  it('every workout has positive sets and reps', () => {
    for (const workout of WORKOUT_LIBRARY) {
      expect(workout.targetSets).toBeGreaterThan(0)
      expect(workout.targetReps).toBeGreaterThan(0)
    }
  })

  it('every workout has at least one muscle group, each a recognized option', () => {
    for (const workout of WORKOUT_LIBRARY) {
      expect(workout.targetMuscleGroups.length).toBeGreaterThan(0)
      for (const group of workout.targetMuscleGroups) {
        expect(MUSCLE_GROUP_OPTIONS).toContain(group)
      }
    }
  })

  it('covers every recognized muscle group across the catalog', () => {
    const covered = new Set(WORKOUT_LIBRARY.flatMap((w) => w.targetMuscleGroups))
    for (const group of MUSCLE_GROUP_OPTIONS) {
      expect(covered.has(group)).toBe(true)
    }
  })

  it('every workout has a recognized movement pattern', () => {
    for (const workout of WORKOUT_LIBRARY) {
      expect(KNOWN_PATTERNS).toContain(workout.movementPattern)
    }
  })
})
