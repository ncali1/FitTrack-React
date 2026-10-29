import { useEffect, useRef, useState } from 'react'
import { useRoutineStore } from '@/stores/routine'
import { useWorkoutTemplatesStore } from '@/stores/workoutTemplates'
import { useActiveProgram } from '@/hooks/useActiveProgram'
import { useExercisesStore } from '@/stores/exercises'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useSettingsStore } from '@/stores/settings'
import { useRestTimerStore } from '@/stores/restTimer'
import { detectNewRecords } from '@/utils/personalRecords'
import { formatWeight } from '@/utils/units'
import { calculateSessionVolume, getExerciseHistory, getPlannedExerciseIds } from '@/utils/calculations'
import { suggestNextPerformance } from '@/utils/progressiveOverload'
import type { Exercise, ExercisePerformance } from '@/types'
import { DaySelector } from './DaySelector'
import { ChecklistItems } from './ChecklistItems'
import type { ChecklistItem } from './ChecklistItems'
import { PerformanceForm } from './PerformanceForm'
import { PRToast } from './PRToast'
import { GuidedSession } from './GuidedSession'
import { SessionGroupPicker } from './SessionGroupPicker'
import { RoutinePicker } from './RoutinePicker'
import { CardioDayCard } from '@/components/cardio/CardioDayCard'

interface SessionSummary {
  count: number
  volumeKg: number
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Shows the list of exercises planned for a selected date as a checklist — whatever the
 * weekly program schedules for that weekday, unless the date was switched to a different
 * routine (see RoutinePicker), in which case that routine's exercises. Toggling an
 * incomplete exercise opens the PerformanceForm so the user can log actual sets, reps,
 * weight, and difficulty. Toggling a completed exercise marks it incomplete. Changes are
 * persisted to the workout sessions store.
 */
export function DailyChecklist() {
  // Select the raw reactive arrays (not the store's getter *methods*, which are stable
  // function references React/Zustand won't re-render on) and derive everything else
  // from them below, so the checklist re-renders whenever routines/exercises/sessions
  // actually change — including changes that don't happen to touch local component state.
  const activeProgram = useActiveProgram()
  const templates = useWorkoutTemplatesStore((s) => s.templates)
  const loadRoutines = useRoutineStore((s) => s.loadRoutines)
  const loadTemplates = useWorkoutTemplatesStore((s) => s.loadTemplates)
  const exercises = useExercisesStore((s) => s.exercises)
  const loadExercises = useExercisesStore((s) => s.loadExercises)
  const sessions = useWorkoutSessionsStore((s) => s.sessions)
  const createSession = useWorkoutSessionsStore((s) => s.createSession)
  const logPerformance = useWorkoutSessionsStore((s) => s.logPerformance)
  const loadSessions = useWorkoutSessionsStore((s) => s.loadSessions)
  const setPlannedExercises = useWorkoutSessionsStore((s) => s.setPlannedExercises)
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
  const [groupPickerExercises, setGroupPickerExercises] = useState<Exercise[] | null>(null)
  const [guidedGroups, setGuidedGroups] = useState<Exercise[][] | null>(null)
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const [showRoutinePicker, setShowRoutinePicker] = useState(false)
  /** Wall-clock start of the current guided session, for computing its total duration on completion. */
  const guidedSessionStartRef = useRef<number | null>(null)

  useEffect(() => {
    Promise.all([loadRoutines(), loadTemplates(), loadExercises(), loadSessions()]).catch((err) => {
      console.error('Failed to load data:', err)
      setError('Failed to load workout data. Please refresh the page.')
    })
  }, [loadRoutines, loadTemplates, loadExercises, loadSessions])

  const currentSession = sessions.find((s) => s.date === selectedDate)
  const isOverridden = currentSession?.plannedExerciseIds !== undefined
  const exerciseIdsForDay = getPlannedExerciseIds(selectedDate, activeProgram, currentSession)
  const exercisesForDay = exerciseIdsForDay
    .map((id) => exercises.find((e) => e.id === id))
    .filter((ex): ex is Exercise => ex !== undefined)

  const completedExerciseIds = (currentSession?.exercises ?? []).filter((e) => e.completed).map((e) => e.exerciseId)

  /** All logged performance entries for the given exercise across all sessions. */
  const performanceByExercise = (exerciseId: string) =>
    sessions.flatMap((s) => s.exercises).filter((e) => e.exerciseId === exerciseId)

  const existingPerformance: ExercisePerformance | null =
    activeExercise && currentSession
      ? (currentSession.exercises.find((e) => e.exerciseId === activeExercise.id) ?? null)
      : null

  const activeExerciseSuggestion = activeExercise
    ? suggestNextPerformance(getExerciseHistory(activeExercise.id, sessions))
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
        isWarmup: performance.isWarmup,
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
      notes: exercise.notes,
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

  /** Shared by the ad-hoc (tap-a-checklist-item) and guided-session logging paths. */
  const logExercisePerformance = async (
    exercise: Exercise,
    performance: Omit<ExercisePerformance, 'exerciseId' | 'timestamp'>
  ) => {
    // Compute PR status against state *before* this submission is applied.
    const priorPerformances = performanceByExercise(exercise.id)
    const { isWeightPR, isRepsPR } = detectNewRecords(priorPerformances, {
      weight: performance.weight,
      actualReps: performance.actualReps,
      isWarmup: performance.isWarmup,
    })

    const sessionId = await ensureSession()
    await logPerformance(sessionId, exercise.id, performance)

    if (isWeightPR || isRepsPR) {
      if (isWeightPR && isRepsPR) {
        setPrMessage(`${exercise.name}: new best weight and reps!`)
      } else if (isWeightPR) {
        setPrMessage(`${exercise.name}: new heaviest weight — ${formatWeight(performance.weight, weightUnit)}${weightUnit}!`)
      } else {
        setPrMessage(`${exercise.name}: new best reps — ${performance.actualReps}!`)
      }
      setPrToastId((id) => id + 1)
    }
  }

  const handlePerformanceSubmit = async (performance: Omit<ExercisePerformance, 'exerciseId' | 'timestamp'>) => {
    if (!activeExercise) return

    try {
      await logExercisePerformance(activeExercise, performance)
      setActiveExercise(null)
      if (performance.completed) {
        startRestTimer(activeExercise.restSeconds ?? restDuration)
      }
    } catch (err) {
      console.error('Failed to submit performance:', err)
      setError('Failed to save workout. Please try again.')
    }
  }

  const handleStartGuidedWorkout = () => {
    const pending = exercisesForDay.filter((ex) => !completedExerciseIds.includes(ex.id))
    if (pending.length === 0) return
    setGroupPickerExercises(pending)
  }

  const handleConfirmGroups = (groups: Exercise[][]) => {
    guidedSessionStartRef.current = Date.now()
    setGuidedGroups(groups)
    setGroupPickerExercises(null)
  }

  const handleGuidedLog = async (
    exercise: Exercise,
    performance: Omit<ExercisePerformance, 'exerciseId' | 'timestamp'>
  ) => {
    try {
      await logExercisePerformance(exercise, performance)
    } catch (err) {
      console.error('Failed to submit performance:', err)
      setError('Failed to save workout. Please try again.')
    }
  }

  const handleGuidedComplete = () => {
    // Reads the store directly (not the reactive `sessions` above) because this runs at
    // the tail of an async chain that began at an earlier render — the closure captured
    // then would be stale and miss the just-logged final exercise.
    const loggedIds = new Set((guidedGroups ?? []).flat().map((ex) => ex.id))
    const session = useWorkoutSessionsStore.getState().sessions.find((s) => s.date === selectedDate)
    const loggedPerformances = (session?.exercises ?? []).filter((p) => loggedIds.has(p.exerciseId))

    if (session && guidedSessionStartRef.current !== null) {
      const durationSeconds = Math.round((Date.now() - guidedSessionStartRef.current) / 1000)
      useWorkoutSessionsStore
        .getState()
        .updateSession(session.id, { durationSeconds })
        .catch((err) => console.error('Failed to save session duration:', err))
    }
    guidedSessionStartRef.current = null

    setSessionSummary({
      count: loggedPerformances.filter((p) => p.completed).length,
      volumeKg: calculateSessionVolume(loggedPerformances),
    })
    setGuidedGroups(null)
  }

  /** Swaps the selected date's plan for a routine's exercises, or adds them to what's there. */
  const handlePickRoutine = async (templateId: string, mode: 'replace' | 'add') => {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    try {
      const exerciseIds =
        mode === 'add' ? [...new Set([...exerciseIdsForDay, ...template.exerciseIds])] : template.exerciseIds
      await setPlannedExercises(selectedDate, exerciseIds)
      setShowRoutinePicker(false)
    } catch (err) {
      console.error('Failed to switch routine:', err)
      setError('Failed to switch routine. Please try again.')
    }
  }

  const handleRestoreSchedule = async () => {
    try {
      await setPlannedExercises(selectedDate, undefined)
    } catch (err) {
      console.error('Failed to restore the scheduled plan:', err)
      setError('Failed to restore the scheduled plan. Please try again.')
    }
  }

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    setActiveExercise(null)
  }

  if (sessionSummary) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 px-2 text-center">
        <div className="w-16 h-16 rounded-full bg-accent-500/15 flex items-center justify-center text-accent-400 text-3xl">
          ✓
        </div>
        <div>
          <h3 className="text-ink">Workout complete</h3>
          <p className="text-ink-muted text-sm mt-1.5">Nice work — that's today's session done.</p>
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <div className="stat-tile flex-1 items-center !p-3.5">
            <div className="text-xl font-semibold text-ink">{sessionSummary.count}</div>
            <div className="text-[11px] text-ink-muted">exercises</div>
          </div>
          <div className="stat-tile flex-1 items-center !p-3.5">
            <div className="text-xl font-semibold text-ink">
              {formatWeight(sessionSummary.volumeKg, weightUnit)}
              {weightUnit}
            </div>
            <div className="text-[11px] text-ink-muted">volume</div>
          </div>
        </div>
        <button className="btn-primary w-full max-w-xs mt-1" onClick={() => setSessionSummary(null)}>
          Done
        </button>
      </div>
    )
  }

  const hasPendingWork = exercisesForDay.some((ex) => !completedExerciseIds.includes(ex.id))

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

      {groupPickerExercises ? (
        <SessionGroupPicker
          exercises={groupPickerExercises}
          onStart={handleConfirmGroups}
          onCancel={() => setGroupPickerExercises(null)}
        />
      ) : guidedGroups ? (
        <GuidedSession
          groups={guidedGroups}
          sessions={sessions}
          restDuration={restDuration}
          onLogExercise={handleGuidedLog}
          onComplete={handleGuidedComplete}
        />
      ) : (
        <>
          <DaySelector selectedDate={selectedDate} onSelectedDateChange={handleDateChange} />

          {exercisesForDay.length === 0 ? (
            <div className="card-pad text-center py-14">
              <div className="empty-blob animate-float">🌙</div>
              <p className="text-ink font-semibold">Rest day</p>
              <p className="text-ink-muted text-sm mt-1">No exercises scheduled for this day.</p>
            </div>
          ) : (
            <>
              <ChecklistItems items={checklistItems} onToggle={handleToggle} />
              {hasPendingWork && (
                <button className="btn-primary w-full" onClick={handleStartGuidedWorkout}>
                  Start guided workout
                </button>
              )}
            </>
          )}

          <div className="flex flex-col items-center gap-1">
            <button className="btn-ghost text-xs" onClick={() => setShowRoutinePicker(true)}>
              {exercisesForDay.length === 0 ? 'Do a routine' : 'Do a different routine'}
            </button>
            {isOverridden && (
              <button className="btn-ghost text-xs" onClick={handleRestoreSchedule}>
                Back to the scheduled plan
              </button>
            )}
          </div>

          <CardioDayCard date={selectedDate} />

          {showRoutinePicker && (
            <RoutinePicker
              templates={templates}
              canAdd={exercisesForDay.length > 0}
              onPick={handlePickRoutine}
              onCancel={() => setShowRoutinePicker(false)}
            />
          )}

          {activeExercise && (
            <PerformanceForm
              key={`${activeExercise.id}-${existingPerformance?.timestamp ?? 'new'}`}
              exerciseId={activeExercise.id}
              exerciseName={activeExercise.name}
              targetSets={activeExercise.targetSets}
              targetReps={activeExercise.targetReps}
              notes={activeExercise.notes}
              existingPerformance={existingPerformance}
              suggestion={activeExerciseSuggestion}
              onSubmit={handlePerformanceSubmit}
              onCancel={() => setActiveExercise(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
