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
  /** Optional free-text form cues, a video link, or any other reminder for this exercise. */
  notes?: string
  /** Overrides the app-wide default rest duration (seconds) for this exercise specifically. */
  restSeconds?: number
  /** Unix milliseconds */
  createdAt: number
  /** Unix milliseconds */
  updatedAt: number
}

/** Maps lowercase day names (e.g. `"monday"`) to arrays of exercise IDs. */
export interface RoutineAssignment {
  [day: string]: string[]
}

/**
 * A named, reusable list of exercises (e.g. "Push Day", "Legs") — what the UI calls a
 * **Routine**. Assigned to days of a weekly program by reference, so editing one updates
 * every day that uses it.
 *
 * Named `WorkoutTemplate` in code because `Routine` (below) was already taken by the
 * weekly plan, whose name is baked into persisted table names.
 */
export interface WorkoutTemplate {
  id: string
  name: string
  /** Ordered exercise IDs. */
  exerciseIds: string[]
  /** Unix milliseconds */
  createdAt: number
  /** Unix milliseconds */
  updatedAt: number
}

/**
 * A saved weekly plan stored in IndexedDB — what the UI calls a **Program**. (The type,
 * store, and tables keep the older "routine" name; see {@link WorkoutTemplate}.)
 */
export interface Routine {
  id: string
  /** User-facing name, e.g. "Push/Pull/Legs" or "5x5". */
  name: string
  /** Whether this is the currently active routine driving the daily checklist. */
  isActive: boolean
  /** Exercises assigned to a day individually, on top of any templates in `weeklyTemplates`. */
  weeklyAssignments: RoutineAssignment
  /** Maps lowercase day names to {@link WorkoutTemplate} IDs assigned to that day, in order.
   *  Absent on plans saved before templates existed. */
  weeklyTemplates?: RoutineAssignment
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
  /** Rate of Perceived Exertion, 6-10 in half-point steps. Optional — a supplementary,
   *  more granular alternative to `difficultyLevel` for anyone who wants it, not a
   *  replacement; nothing in the app requires it to be set. */
  rpe?: number
  /** Marks this logged performance as a warm-up rather than a working set — excluded from
   *  personal records, session volume, muscle-balance set counts, 1RM estimates, and
   *  progressive-overload suggestions, all of which should reflect working effort only. */
  isWarmup?: boolean
  /** Unix milliseconds */
  timestamp: number
}

/** A daily workout session containing performance entries for multiple exercises. */
export interface WorkoutSession {
  id: string
  /** YYYY-MM-DD format */
  date: string
  exercises: ExercisePerformance[]
  /** Wall-clock length of a completed guided session, in seconds — set once when a
   *  guided workout finishes; absent for days logged entirely via the ad-hoc checklist. */
  durationSeconds?: number
  /** When set, the exact exercises planned for this date, replacing whatever the weekly
   *  program schedules for that weekday — set by doing a different routine on the day. A
   *  snapshot of IDs rather than a template reference, so later edits to the template
   *  don't rewrite history. */
  plannedExerciseIds?: string[]
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
