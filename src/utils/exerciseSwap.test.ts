import { describe, it, expect } from 'vitest'
import { findSwapCandidates } from './exerciseSwap'
import type { LibraryWorkout } from '@/data/workoutLibrary'
import { createMockExercise } from '@/tests/factories'

function libraryEntry(name: string, targetMuscleGroups: string[], overrides?: Partial<LibraryWorkout>): LibraryWorkout {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    description: '',
    targetSets: 3,
    targetReps: 10,
    targetMuscleGroups,
    movementPattern: 'press',
    ...overrides,
  }
}

const LIBRARY = [
  libraryEntry('Barbell Bench Press', ['Chest', 'Triceps', 'Shoulders']),
  libraryEntry('Push-Up', ['Chest', 'Triceps', 'Core']),
  libraryEntry('Dip', ['Triceps', 'Chest']),
  libraryEntry('Barbell Squat', ['Quadriceps', 'Glutes'], { movementPattern: 'bob' }),
  libraryEntry('Bicep Curl', ['Biceps'], { movementPattern: 'curl' }),
]

const names = (candidates: { name: string }[]) => candidates.map((c) => c.name)

describe('findSwapCandidates', () => {
  it('ranks same-primary-muscle exercises above ones that only share a secondary muscle', () => {
    const target = { name: 'Cable Fly', targetMuscleGroups: ['Chest'] }
    expect(names(findSwapCandidates(target, [], LIBRARY))).toEqual(['Barbell Bench Press', 'Push-Up', 'Dip'])
  })

  it('leaves out exercises sharing no muscle region with the target', () => {
    const target = { name: 'Cable Fly', targetMuscleGroups: ['Chest'] }
    const result = names(findSwapCandidates(target, [], LIBRARY))
    expect(result).not.toContain('Barbell Squat')
    expect(result).not.toContain('Bicep Curl')
  })

  it('matches by region, so "Legs" overlaps "Quadriceps"', () => {
    const target = { name: 'Leg Press', targetMuscleGroups: ['Legs'] }
    expect(names(findSwapCandidates(target, [], LIBRARY))).toEqual(['Barbell Squat'])
  })

  it('excludes the target itself and any excluded names, case-insensitively', () => {
    const target = { name: 'barbell bench press', targetMuscleGroups: ['Chest'] }
    expect(names(findSwapCandidates(target, [], LIBRARY, ['PUSH-UP']))).toEqual(['Dip'])
  })

  it("merges a user's exercise with the same-named library entry, keeping the user's muscle groups", () => {
    const mine = createMockExercise({ name: 'push-up', targetMuscleGroups: ['Chest'] })
    const [first] = findSwapCandidates({ name: 'Cable Fly', targetMuscleGroups: ['Chest'] }, [mine], LIBRARY).filter(
      (c) => c.name === 'push-up'
    )
    expect(first.exercise).toBe(mine)
    expect(first.libraryWorkout?.name).toBe('Push-Up')
    expect(first.movementPattern).toBe('press')
    expect(first.targetMuscleGroups).toEqual(['Chest'])
  })

  it("includes the user's own exercises that aren't in the library, preferring them on a tie", () => {
    const mine = createMockExercise({ name: 'Machine Chest Press', targetMuscleGroups: ['Chest', 'Triceps', 'Shoulders'] })
    const result = findSwapCandidates({ name: 'Cable Fly', targetMuscleGroups: ['Chest'] }, [mine], LIBRARY)
    expect(names(result).slice(0, 2)).toEqual(['Machine Chest Press', 'Barbell Bench Press'])
    expect(result[0].movementPattern).toBeUndefined()
  })

  it('returns nothing for a target with no known muscle groups', () => {
    expect(findSwapCandidates({ name: 'Mystery', targetMuscleGroups: [] }, [], LIBRARY)).toEqual([])
    expect(findSwapCandidates({ name: 'Mystery', targetMuscleGroups: ['Nonsense'] }, [], LIBRARY)).toEqual([])
  })
})
