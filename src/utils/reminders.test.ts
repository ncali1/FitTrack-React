import { describe, it, expect } from 'vitest'
import { shouldNudgeToday } from './reminders'
import { createMockRoutine, createMockWorkoutSession } from '@/tests/factories'

const MONDAY = '2025-01-06' // known Monday

function routineWith(weeklyAssignments: Record<string, string[]>) {
  return createMockRoutine({ weeklyAssignments: { ...createMockRoutine().weeklyAssignments, ...weeklyAssignments } })
}

describe('shouldNudgeToday', () => {
  it('returns false when there is no routine yet', () => {
    expect(shouldNudgeToday(null, [], MONDAY)).toBe(false)
  })

  it('returns false when today has nothing assigned in the routine', () => {
    expect(shouldNudgeToday(routineWith({ monday: [] }), [], MONDAY)).toBe(false)
  })

  it('returns true when today is assigned and nothing has been logged', () => {
    expect(shouldNudgeToday(routineWith({ monday: ['ex1'] }), [], MONDAY)).toBe(true)
  })

  it('returns false when today is assigned but already logged as completed', () => {
    const session = createMockWorkoutSession({
      date: MONDAY,
      exercises: [{ exerciseId: 'ex1', completed: true, timestamp: 1 }],
    })
    expect(shouldNudgeToday(routineWith({ monday: ['ex1'] }), [session], MONDAY)).toBe(false)
  })

  it('returns true when a session exists for today but nothing in it is completed', () => {
    const session = createMockWorkoutSession({
      date: MONDAY,
      exercises: [{ exerciseId: 'ex1', completed: false, timestamp: 1 }],
    })
    expect(shouldNudgeToday(routineWith({ monday: ['ex1'] }), [session], MONDAY)).toBe(true)
  })

  it('ignores completed entries logged on a different date', () => {
    const session = createMockWorkoutSession({
      date: '2025-01-05',
      exercises: [{ exerciseId: 'ex1', completed: true, timestamp: 1 }],
    })
    expect(shouldNudgeToday(routineWith({ monday: ['ex1'] }), [session], MONDAY)).toBe(true)
  })
})
