import { describe, it, expect } from 'vitest'
import {
  validateExerciseName,
  validateSets,
  validateReps,
  validateMuscleGroups,
  validateWeight,
  validateDifficultyLevel,
  validateDate,
  validateExerciseForm,
  validatePerformanceForm,
} from './validators'

describe('validateExerciseName', () => {
  it('rejects empty or whitespace-only names', () => {
    expect(validateExerciseName('').valid).toBe(false)
    expect(validateExerciseName('   ').valid).toBe(false)
  })

  it('rejects names over 255 characters', () => {
    expect(validateExerciseName('a'.repeat(256)).valid).toBe(false)
  })

  it('accepts a normal name', () => {
    expect(validateExerciseName('Bench Press').valid).toBe(true)
  })
})

describe('validateSets / validateReps', () => {
  it('reject zero, negative, non-integer, and missing values', () => {
    for (const validate of [validateSets, validateReps]) {
      expect(validate(0).valid).toBe(false)
      expect(validate(-1).valid).toBe(false)
      expect(validate(1.5).valid).toBe(false)
      expect(validate(null).valid).toBe(false)
      expect(validate(undefined).valid).toBe(false)
    }
  })

  it('accept positive integers', () => {
    expect(validateSets(3).valid).toBe(true)
    expect(validateReps(10).valid).toBe(true)
  })
})

describe('validateMuscleGroups', () => {
  it('rejects an empty list', () => {
    expect(validateMuscleGroups([]).valid).toBe(false)
  })

  it('rejects a list of only blank strings', () => {
    expect(validateMuscleGroups(['', '   ']).valid).toBe(false)
  })

  it('accepts at least one non-empty group', () => {
    expect(validateMuscleGroups(['Chest']).valid).toBe(true)
  })
})

describe('validateWeight', () => {
  it('treats absence as valid (weight is optional)', () => {
    expect(validateWeight(null).valid).toBe(true)
    expect(validateWeight(undefined).valid).toBe(true)
  })

  it('rejects negative weight', () => {
    expect(validateWeight(-5).valid).toBe(false)
  })

  it('accepts zero and positive weight', () => {
    expect(validateWeight(0).valid).toBe(true)
    expect(validateWeight(60).valid).toBe(true)
  })
})

describe('validateDifficultyLevel', () => {
  it('accepts easy, moderate, hard', () => {
    expect(validateDifficultyLevel('easy').valid).toBe(true)
    expect(validateDifficultyLevel('moderate').valid).toBe(true)
    expect(validateDifficultyLevel('hard').valid).toBe(true)
  })

  it('rejects anything else, including empty', () => {
    expect(validateDifficultyLevel('extreme').valid).toBe(false)
    expect(validateDifficultyLevel(null).valid).toBe(false)
    expect(validateDifficultyLevel(undefined).valid).toBe(false)
  })
})

describe('validateDate', () => {
  it('accepts a well-formed calendar date', () => {
    expect(validateDate('2025-01-06').valid).toBe(true)
  })

  it('rejects malformed strings', () => {
    expect(validateDate('01/06/2025').valid).toBe(false)
    expect(validateDate('').valid).toBe(false)
  })

  it('rejects calendar-invalid dates (e.g. Feb 30)', () => {
    expect(validateDate('2025-02-30').valid).toBe(false)
  })
})

describe('validateExerciseForm', () => {
  it('returns no errors for a fully valid form', () => {
    const errors = validateExerciseForm({
      name: 'Bench Press',
      targetSets: 3,
      targetReps: 10,
      targetMuscleGroups: ['Chest'],
    })
    expect(errors).toEqual({})
  })

  it('collects one error per invalid field', () => {
    const errors = validateExerciseForm({ name: '', targetSets: 0, targetReps: 0, targetMuscleGroups: [] })
    expect(Object.keys(errors).sort()).toEqual(['name', 'targetMuscleGroups', 'targetReps', 'targetSets'])
  })
})

describe('validatePerformanceForm', () => {
  it('returns no errors for a fully valid form', () => {
    const errors = validatePerformanceForm({
      actualSets: 3,
      actualReps: 10,
      weight: 50,
      difficultyLevel: 'moderate',
    })
    expect(errors).toEqual({})
  })

  it('treats a missing (optional) weight as valid', () => {
    const errors = validatePerformanceForm({
      actualSets: 3,
      actualReps: 10,
      weight: null,
      difficultyLevel: 'easy',
    })
    expect(errors.weight).toBeUndefined()
  })

  it('requires difficultyLevel', () => {
    const errors = validatePerformanceForm({ actualSets: 3, actualReps: 10, weight: null, difficultyLevel: null })
    expect(errors.difficultyLevel).toBeDefined()
  })
})
