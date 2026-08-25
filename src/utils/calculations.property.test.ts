/**
 * Property-based tests for the weekly-summary and progress-graph calculation
 * functions: instead of asserting one exact expected output, these generate many
 * scenarios and assert invariants that must hold for *all* of them (percentages stay
 * in [0, 100], completed never exceeds assigned, averages are never negative, weeks
 * outside a range never leak in, etc.).
 *
 * Ported from the original's Property 6/7/8 test suites, but pointed at the real
 * `calculateWeeklySummary` / `aggregateProgressData` / `getWeeksInRange` functions in
 * this file rather than a second copy of the calculation logic duplicated into the
 * test file (which is what the original did) — see utils/calculations.test.ts for
 * why that distinction matters.
 */
import { describe, it, expect } from 'vitest'
import { calculateWeeklySummary, aggregateProgressData, getWeeksInRange, getWeekStart } from './calculations'
import { createMockRoutine, createMockWorkoutSession } from '@/tests/factories'
import type { Routine, WorkoutSession } from '@/types'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type Day = (typeof DAYS)[number]

function routineFor(assignedPerDay: Record<Day, number>): Routine {
  const weeklyAssignments: Record<string, string[]> = {}
  for (const day of DAYS) {
    weeklyAssignments[day] = Array.from({ length: assignedPerDay[day] }, (_, i) => `ex-${day}-${i}`)
  }
  return createMockRoutine({ weeklyAssignments })
}

// ── Property 6: Weekly Summary Calculation ─────────────────────────────────────

interface WeekScenario {
  label: string
  assignedPerDay: Record<Day, number>
  completedPerDay: Record<Day, number>
}

function generateWeekScenarios(): WeekScenario[] {
  const zero: Record<Day, number> = {
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
    saturday: 0,
    sunday: 0,
  }

  return [
    { label: 'all rest days', assignedPerDay: zero, completedPerDay: zero },
    {
      label: '1 exercise every day, all completed',
      assignedPerDay: { ...zero, monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1, sunday: 1 },
      completedPerDay: { ...zero, monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1, sunday: 1 },
    },
    {
      label: '2 exercises every day, none completed',
      assignedPerDay: { ...zero, monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2, saturday: 2, sunday: 2 },
      completedPerDay: zero,
    },
    {
      label: 'typical 3-day split, partial completion',
      assignedPerDay: { ...zero, monday: 3, wednesday: 3, friday: 3 },
      completedPerDay: { ...zero, monday: 2, wednesday: 3, friday: 1 },
    },
    {
      label: '5-day plan, all completed',
      assignedPerDay: { ...zero, monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2 },
      completedPerDay: { ...zero, monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2 },
    },
    {
      label: 'weekend warrior',
      assignedPerDay: { ...zero, saturday: 4, sunday: 4 },
      completedPerDay: { ...zero, saturday: 2, sunday: 4 },
    },
  ]
}

/** Builds one WorkoutSession per assigned day, with the given number marked completed. */
function sessionsFor(weekStart: string, assignedPerDay: Record<Day, number>, completedPerDay: Record<Day, number>) {
  const sessions: WorkoutSession[] = []
  DAYS.forEach((day, i) => {
    const assigned = assignedPerDay[day]
    if (assigned === 0) return
    const completed = completedPerDay[day]
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]!

    sessions.push(
      createMockWorkoutSession({
        date: dateStr,
        exercises: Array.from({ length: assigned }, (_, j) => ({
          exerciseId: `ex-${day}-${j}`,
          completed: j < completed,
          timestamp: Date.now(),
        })),
      })
    )
  })
  return sessions
}

describe('Property: Weekly Summary Calculation', () => {
  const WEEK_START = '2025-01-06' // a known Monday

  it('holds totals, percentage-bounds, and per-day-accuracy invariants for every scenario', () => {
    for (const scenario of generateWeekScenarios()) {
      const routine = routineFor(scenario.assignedPerDay)
      const sessions = sessionsFor(WEEK_START, scenario.assignedPerDay, scenario.completedPerDay)
      const result = calculateWeeklySummary(WEEK_START, routine, sessions)

      const expectedAssigned = Object.values(scenario.assignedPerDay).reduce((a, b) => a + b, 0)
      const expectedCompleted = Object.values(scenario.completedPerDay).reduce((a, b) => a + b, 0)
      const expectedPct = expectedAssigned === 0 ? 0 : Math.round((expectedCompleted / expectedAssigned) * 100)

      expect(result.totalAssignedWorkouts, scenario.label).toBe(expectedAssigned)
      expect(result.totalCompletedWorkouts, scenario.label).toBe(expectedCompleted)
      expect(result.completionPercentage, scenario.label).toBe(expectedPct)

      // Property: completed never exceeds assigned, at the total or per-day level
      expect(result.totalCompletedWorkouts).toBeLessThanOrEqual(result.totalAssignedWorkouts)
      for (const day of DAYS) {
        const { assigned, completed } = result.dailyBreakdown[day]!
        expect(completed, `${scenario.label} / ${day}`).toBeLessThanOrEqual(assigned)
        expect(assigned).toBe(scenario.assignedPerDay[day])
        expect(completed).toBe(scenario.completedPerDay[day])
      }

      // Property: percentage always lands in [0, 100]
      expect(result.completionPercentage).toBeGreaterThanOrEqual(0)
      expect(result.completionPercentage).toBeLessThanOrEqual(100)
    }
  })

  it('always includes all 7 days in the breakdown, even for an empty routine', () => {
    const result = calculateWeeklySummary(WEEK_START, createMockRoutine(), [])
    for (const day of DAYS) {
      expect(result.dailyBreakdown[day]).toBeDefined()
    }
  })
})

// ── Property 7: Weekly Summary Retrieval ───────────────────────────────────────

describe('Property: Weekly Summary Retrieval', () => {
  it('retrieves independent, non-leaking summaries for different weeks', () => {
    const routine = routineFor({
      monday: 1,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0,
    })

    // Week 1 (2025-01-06): completed. Week 2 (2025-01-13): no session at all. Week 3
    // (2025-01-20): completed.
    const sessions = [
      createMockWorkoutSession({
        date: '2025-01-06',
        exercises: [{ exerciseId: 'ex-monday-0', completed: true, timestamp: 1 }],
      }),
      createMockWorkoutSession({
        date: '2025-01-20',
        exercises: [{ exerciseId: 'ex-monday-0', completed: true, timestamp: 2 }],
      }),
    ]

    expect(calculateWeeklySummary('2025-01-06', routine, sessions).totalCompletedWorkouts).toBe(1)
    expect(calculateWeeklySummary('2025-01-13', routine, sessions).totalCompletedWorkouts).toBe(0)
    expect(calculateWeeklySummary('2025-01-20', routine, sessions).totalCompletedWorkouts).toBe(1)
  })

  it('does not let data from one week affect another week — assigned counts still apply everywhere', () => {
    const routine = routineFor({
      monday: 0,
      tuesday: 0,
      wednesday: 1,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0,
    })
    const sessions = [
      createMockWorkoutSession({
        date: '2025-01-08', // Wednesday of week 1
        exercises: [{ exerciseId: 'ex-wednesday-0', completed: true, timestamp: 1 }],
      }),
    ]

    const week1 = calculateWeeklySummary('2025-01-06', routine, sessions)
    const week2 = calculateWeeklySummary('2025-01-13', routine, sessions)

    expect(week1.totalCompletedWorkouts).toBe(1)
    expect(week2.totalCompletedWorkouts).toBe(0)
    expect(week2.totalAssignedWorkouts).toBe(1) // the routine still applies every week
  })

  it('correctly identifies the Monday for any day of the week', () => {
    const cases: Array<[string, string]> = [
      ['2025-01-06', '2025-01-06'], // Monday
      ['2025-01-07', '2025-01-06'], // Tuesday
      ['2025-01-08', '2025-01-06'], // Wednesday
      ['2025-01-09', '2025-01-06'], // Thursday
      ['2025-01-10', '2025-01-06'], // Friday
      ['2025-01-11', '2025-01-06'], // Saturday
      ['2025-01-12', '2025-01-06'], // Sunday
      ['2025-01-13', '2025-01-13'], // next Monday
    ]
    for (const [input, expected] of cases) {
      expect(getWeekStart(input)).toBe(expected)
    }
  })

  it('produces identical results when the same week is queried multiple times', () => {
    const routine = routineFor({
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 1,
      saturday: 0,
      sunday: 0,
    })
    const sessions = [
      createMockWorkoutSession({
        date: '2025-01-10',
        exercises: [{ exerciseId: 'ex-friday-0', completed: true, timestamp: 1 }],
      }),
    ]

    const result1 = calculateWeeklySummary('2025-01-06', routine, sessions)
    const result2 = calculateWeeklySummary('2025-01-06', routine, sessions)

    expect(result1).toEqual(result2)
  })
})

// ── Property 8: Progress Graph Data Generation ─────────────────────────────────

interface GraphScenario {
  label: string
  rangeStart: string
  rangeEnd: string
  performances: Array<{ date: string; completed: boolean; actualReps?: number; weight?: number }>
}

function generateGraphScenarios(): GraphScenario[] {
  return [
    { label: 'empty performance data', rangeStart: '2025-01-06', rangeEnd: '2025-01-26', performances: [] },
    {
      label: 'single week with one performance',
      rangeStart: '2025-01-06',
      rangeEnd: '2025-01-12',
      performances: [{ date: '2025-01-07', completed: true, actualReps: 10, weight: 50 }],
    },
    {
      label: 'multiple weeks with varying data',
      rangeStart: '2025-01-06',
      rangeEnd: '2025-01-26',
      performances: [
        { date: '2025-01-06', completed: true, actualReps: 8, weight: 60 },
        { date: '2025-01-08', completed: true, actualReps: 10, weight: 65 },
        { date: '2025-01-13', completed: true, actualReps: 12 },
        { date: '2025-01-20', completed: true, actualReps: 15, weight: 70 },
        { date: '2025-01-22', completed: true, actualReps: 14, weight: 72 },
      ],
    },
    {
      label: 'weeks with no weight data',
      rangeStart: '2025-01-06',
      rangeEnd: '2025-01-19',
      performances: [
        { date: '2025-01-07', completed: true, actualReps: 10 },
        { date: '2025-01-14', completed: true, actualReps: 12 },
      ],
    },
    {
      label: 'mixed completed and incomplete performances',
      rangeStart: '2025-01-06',
      rangeEnd: '2025-01-12',
      performances: [
        { date: '2025-01-06', completed: true, actualReps: 10, weight: 50 },
        { date: '2025-01-07', completed: false, actualReps: 20, weight: 100 },
        { date: '2025-01-08', completed: true, actualReps: 12, weight: 55 },
        { date: '2025-01-09', completed: false, actualReps: 30, weight: 200 },
      ],
    },
    {
      label: 'time range excludes some data',
      rangeStart: '2025-01-13',
      rangeEnd: '2025-01-19',
      performances: [
        { date: '2025-01-06', completed: true, actualReps: 99, weight: 999 }, // before range
        { date: '2025-01-14', completed: true, actualReps: 10, weight: 50 }, // inside range
        { date: '2025-01-20', completed: true, actualReps: 88, weight: 888 }, // after range
      ],
    },
  ]
}

function sessionsFromPerformances(exerciseId: string, performances: GraphScenario['performances']): WorkoutSession[] {
  return performances.map((p) =>
    createMockWorkoutSession({
      date: p.date,
      exercises: [{ exerciseId, completed: p.completed, actualReps: p.actualReps, weight: p.weight, timestamp: 1 }],
    })
  )
}

describe('Property: Progress Graph Data Generation', () => {
  const EXERCISE_ID = 'ex1'
  const ROUTINE = createMockRoutine() // assignment counts aren't under test here

  it('weeklyData length always matches getWeeksInRange for every scenario', () => {
    for (const scenario of generateGraphScenarios()) {
      const weeks = getWeeksInRange(scenario.rangeStart, scenario.rangeEnd)
      const sessions = sessionsFromPerformances(EXERCISE_ID, scenario.performances)
      const result = aggregateProgressData(EXERCISE_ID, 'Exercise', scenario.rangeStart, scenario.rangeEnd, sessions, ROUTINE)

      expect(result.weeklyData, scenario.label).toHaveLength(weeks.length)
    }
  })

  it('averageReps and averageWeight are never negative for any scenario', () => {
    for (const scenario of generateGraphScenarios()) {
      const sessions = sessionsFromPerformances(EXERCISE_ID, scenario.performances)
      const result = aggregateProgressData(EXERCISE_ID, 'Exercise', scenario.rangeStart, scenario.rangeEnd, sessions, ROUTINE)

      result.weeklyData.forEach((w, i) => {
        expect(w.averageReps, `${scenario.label} week ${i}`).toBeGreaterThanOrEqual(0)
        expect(w.averageWeight, `${scenario.label} week ${i}`).toBeGreaterThanOrEqual(0)
      })
    }
  })

  it('performances outside the requested range never affect weeks inside it', () => {
    const sessions = sessionsFromPerformances(EXERCISE_ID, [
      { date: '2025-01-06', completed: true, actualReps: 99, weight: 999 }, // before range
      { date: '2025-01-14', completed: true, actualReps: 10, weight: 50 }, // in range
      { date: '2025-01-20', completed: true, actualReps: 88, weight: 888 }, // after range
    ])

    const result = aggregateProgressData(EXERCISE_ID, 'Exercise', '2025-01-13', '2025-01-19', sessions, ROUTINE)

    expect(result.weeklyData).toHaveLength(1)
    expect(result.weeklyData[0]!.averageReps).toBe(10)
    expect(result.weeklyData[0]!.averageWeight).toBe(50)
  })

  it('incomplete performances never contribute to reps or weight averages', () => {
    const sessions = sessionsFromPerformances(EXERCISE_ID, [
      { date: '2025-01-06', completed: true, actualReps: 10, weight: 50 },
      { date: '2025-01-07', completed: false, actualReps: 20, weight: 100 },
      { date: '2025-01-08', completed: false, actualReps: 30, weight: 200 },
    ])

    const result = aggregateProgressData(EXERCISE_ID, 'Exercise', '2025-01-06', '2025-01-12', sessions, ROUTINE)

    expect(result.weeklyData[0]!.averageReps).toBe(10)
    expect(result.weeklyData[0]!.averageWeight).toBe(50)
  })
})
