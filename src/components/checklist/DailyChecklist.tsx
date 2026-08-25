import { useEffect, useState } from 'react'
import { useRoutineStore, selectRoutineForDay } from '@/stores/routine'
import { useExercisesStore } from '@/stores/exercises'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useSettingsStore } from '@/stores/settings'
import { useRestTimerStore } from '@/stores/restTimer'
import { detectNewRecords } from '@/utils/personalRecords'
import { formatWeight } from '@/utils/units'
import type { Exercise, ExercisePerformance } from '@/types'
import { DaySelector } from './DaySelector'
import { ChecklistItems } from './ChecklistItems'
import type { ChecklistItem } from './ChecklistItems'
import { PerformanceForm } from './PerformanceForm'
import { PRToast } from './PRToast'

const DAY_NAMES: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Returns the lowercase day-of-week name for a YYYY-MM-DD date string. */
function dayOfWeekFromDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, day!)
  return DAY_NAMES[d.getDay()] ?? 'monday'
}

/**
 * Shows the list of exercises assigned to a selected date as a checklist. Toggling an
 * incomplete exercise opens the PerformanceForm so the user can log actual sets, reps,
 * weight, and difficulty. Toggling a completed exercise marks it incomplete. Changes are
 * persisted to the workout sessions store.
 */
export function DailyChecklist() {
  // Select the raw reactive arrays (not the store's getter *methods*, which are stable
  // function references React/Zustand won't re-render on) and derive everything else
  // from them below, so the checklist re-renders whenever routines/exercises/sessions
  // actually change — including changes that don't happen to touch local component state.
  const routines = useRoutineStore((s) => s.routines)
  const loadRoutines = useRoutineStore((s) => s.loadRoutines)
  const exercises = useExercisesStore((s) => s.exercises)
  const loadExercises = useExercisesStore((s) => s.loadExercises)
  const sessions = useWorkoutSessionsStore((s) => s.sessions)
  const createSession = useWorkoutSessionsStore((s) => s.createSession)
  const logPerformance = useWorkoutSessionsStore((s) => s.logPerformance)
  const loadSessions = useWorkoutSessionsStore((s) => s.loadSessions)
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const restDuration = useSettingsStore((s) => s.restDuration)
  const startRestTimer = useRestTimerStore((s) => s.start)

  const [selectedDate, setSelectedDate] = useState(todayString())
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prMessage, setPrMessage] = useState<string | null>(null)
  // Distinguishes consecutive PR toasts that happen to share the same message text, so
  // PRToast always remounts (and replays its enter animation + dismiss timer) for a new PR.
  const [prToastId, setPrToastId] = useState(0)

  useEffect(() => {
    Promise.all([loadRoutines(), loadExercises(), loadSessions()]).catch((err) => {
      console.error('Failed to load data:', err)
      setError('Failed to load workout data. Please refresh the page.')
    })
  }, [loadRoutines, loadExercises, loadSessions])

  const exerciseIdsForDay = selectRoutineForDay(routines, dayOfWeekFromDate(selectedDate))
  const exercisesForDay = exerciseIdsForDay
    .map((id) => exercises.find((e) => e.id === id))
    .filter((ex): ex is Exercise => ex !== undefined)

  const currentSession = sessions.find((s) => s.date === selectedDate)
  const completedExerciseIds = (currentSession?.exercises ?? []).filter((e) => e.completed).map((e) => e.exerciseId)

  /** All logged performance entries for the given exercise across all sessions. */
  const performanceByExercise = (exerciseId: string) =>
    sessions.flatMap((s) => s.exercises).filter((e) => e.exerciseId === exerciseId)

  const existingPerformance: ExercisePerformance | null =
    activeExercise && currentSession
      ? (currentSession.exercises.find((e) => e.exerciseId === activeExercise.id) ?? null)
      : null

  const checklistItems: ChecklistItem[] = exercisesForDay.map((exercise) => {
    const performance = currentSession?.exercises.find((p) => p.exerciseId === exercise.id)

    let isWeightPR = false
    let isRepsPR = false
    if (performance?.completed) {
      const allPerformances = performanceByExercise(exercise.id)
      const priorPerformances = allPerformances.filter((p) => p.timestamp !== performance.timestamp)
      const flags = detectNewRecords(priorPerformances, {
        weight: performance.weight,
        actualReps: performance.actualReps,
      })
      isWeightPR = flags.isWeightPR
      isRepsPR = flags.isRepsPR
    }

    return {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
      targetMuscleGroups: exercise.targetMuscleGroups,
      completed: performance?.completed ?? false,
      performance,
      isWeightPR,
      isRepsPR,
    }
  })

  /** Returns the ID of the existing session for the selected date, creating a new one if needed. */
  async function ensureSession(): Promise<string> {
    if (currentSession) return currentSession.id
    const created = await createSession(selectedDate)
    return created.id
  }

  const handleToggle = async (exerciseId: string) => {
    const exercise = exercises.find((e) => e.id === exerciseId)
    if (!exercise) return

    const isCompleted = completedExerciseIds.includes(exerciseId)

    try {
      if (isCompleted) {
        const sessionId = await ensureSession()
        await logPerformance(sessionId, exerciseId, { completed: false })
        if (activeExercise?.id === exerciseId) setActiveExercise(null)
      } else {
        setActiveExercise(exercise)
      }
    } catch (err) {
      console.error('Failed to toggle exercise:', err)
      setError('Failed to save workout. Please try again.')
    }
  }

  const handlePerformanceSubmit = async (performance: Omit<ExercisePerformance, 'exerciseId' | 'timestamp'>) => {
    if (!activeExercise) return
    const exerciseName = activeExercise.name

    try {
      // Compute PR status against state *before* this submission is applied.
      const priorPerformances = performanceByExercise(activeExercise.id)
      const { isWeightPR, isRepsPR } = detectNewRecords(priorPerformances, {
        weight: performance.weight,
        actualReps: performance.actualReps,
      })

      const sessionId = await ensureSession()
      await logPerformance(sessionId, activeExercise.id, performance)
      setActiveExercise(null)

      if (isWeightPR || isRepsPR) {
        if (isWeightPR && isRepsPR) {
          setPrMessage(`${exerciseName}: new best weight and reps!`)
        } else if (isWeightPR) {
          setPrMessage(`${exerciseName}: new heaviest weight — ${formatWeight(performance.weight, weightUnit)}${weightUnit}!`)
        } else {
          setPrMessage(`${exerciseName}: new best reps — ${performance.actualReps}!`)
        }
        setPrToastId((id) => id + 1)
      }

      if (performance.completed) {
        startRestTimer(restDuration)
      }
    } catch (err) {
      console.error('Failed to submit performance:', err)
      setError('Failed to save workout. Please try again.')
    }
  }

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    setActiveExercise(null)
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="alert-error">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 ml-2 text-lg leading-none"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {prMessage && <PRToast key={prToastId} message={prMessage} onDismissed={() => setPrMessage(null)} />}

      <DaySelector selectedDate={selectedDate} onSelectedDateChange={handleDateChange} />

      {exercisesForDay.length === 0 ? (
        <div className="card-pad text-center py-14">
          <div className="empty-blob animate-float">🌙</div>
          <p className="text-ink font-semibold">Rest day</p>
          <p className="text-ink-muted text-sm mt-1">No exercises scheduled for this day.</p>
        </div>
      ) : (
        <ChecklistItems items={checklistItems} onToggle={handleToggle} />
      )}

      {activeExercise && (
        <PerformanceForm
          key={`${activeExercise.id}-${existingPerformance?.timestamp ?? 'new'}`}
          exerciseId={activeExercise.id}
          exerciseName={activeExercise.name}
          targetSets={activeExercise.targetSets}
          targetReps={activeExercise.targetReps}
          existingPerformance={existingPerformance}
          onSubmit={handlePerformanceSubmit}
          onCancel={() => setActiveExercise(null)}
        />
      )}
    </div>
  )
}
