/**
 * Core data types shared across stores, services, and utils.
 * Timestamps are stored as Unix milliseconds (Date.now()) for compatibility with IndexedDB.
 */

/** A user-defined exercise with target performance metrics. */
export interface Exercise {
  id: string
  name: string
  targetSets: number
  targetReps: number
  targetMuscleGroups: string[]
  /** Unix milliseconds */
  createdAt: number
  /** Unix milliseconds */
  updatedAt: number
}

/** Maps lowercase day names (e.g. `"monday"`) to arrays of exercise IDs. */
export interface RoutineAssignment {
  [day: string]: string[]
}

/** A saved weekly routine/program document stored in IndexedDB. */
export interface Routine {
  id: string
  /** User-facing name, e.g. "Push/Pull/Legs" or "5x5". */
  name: string
  /** Whether this is the currently active routine driving the daily checklist. */
  isActive: boolean
  weeklyAssignments: RoutineAssignment
  /** Unix milliseconds */
  createdAt: number
  /** Unix milliseconds */
  updatedAt: number
}

/** Actual performance data logged for one exercise within a workout session. */
export interface ExercisePerformance {
  exerciseId: string
  completed: boolean
  actualSets?: number
  actualReps?: number
  /** Weight used in kg; omit if bodyweight only */
  weight?: number
  difficultyLevel?: 'easy' | 'moderate' | 'hard'
  /** Unix milliseconds */
  timestamp: number
}

/** A daily workout session containing performance entries for multiple exercises. */
export interface WorkoutSession {
  id: string
  /** YYYY-MM-DD format */
  date: string
  exercises: ExercisePerformance[]
  /** Unix milliseconds */
  createdAt: number
  /** Unix milliseconds */
  updatedAt: number
}

/** A single day's logged body weight, separate from workout performance data. */
export interface BodyWeightLog {
  id: string
  /** YYYY-MM-DD format; logging again on the same date overwrites this entry. */
  date: string
  /** Canonical weight in kg; display-unit conversion happens only at render time. */
  weightKg: number
  /** Unix milliseconds */
  createdAt: number
  /** Unix milliseconds */
  updatedAt: number
}

/** Days of the week for routine assignments. */
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

/** Difficulty levels for performance logging. */
export type DifficultyLevel = 'easy' | 'moderate' | 'hard'

/** Computed weekly summary statistics. */
export interface WeeklySummary {
  weekStartDate: Date
  weekEndDate: Date
  totalAssignedWorkouts: number
  totalCompletedWorkouts: number
  completionPercentage: number
  dailyBreakdown: {
    [day: string]: {
      assigned: number
      completed: number
    }
  }
}

/** Computed progress data aggregation for one exercise over a time range. */
export interface ProgressData {
  exerciseId: string
  exerciseName: string
  timeRange: {
    startDate: Date
    endDate: Date
  }
  weeklyData: Array<{
    weekStartDate: Date
    averageReps: number
    averageWeight: number
    completionCount: number
    totalAssigned: number
  }>
}
