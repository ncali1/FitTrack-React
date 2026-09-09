import { useEffect, useMemo, useState } from 'react'
import { useUIStore } from '@/stores/ui'
import { useExercisesStore } from '@/stores/exercises'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useRoutineStore, selectActiveRoutine } from '@/stores/routine'
import { useBodyWeightStore } from '@/stores/bodyWeight'
import { useSettingsStore } from '@/stores/settings'
import { calculatePersonalRecord } from '@/utils/personalRecords'
import { bestEstimatedOneRepMax } from '@/utils/oneRepMax'
import { calculateWeeklySummary, getWeekStart, getDayOfWeek, addDays } from '@/utils/calculations'
import { calculateMuscleGroupSets } from '@/utils/muscleBalance'
import { formatWeight } from '@/utils/units'
import { WeeklyBars } from './WeeklyBars'
import { MuscleBalance } from './MuscleBalance'
import { RepsChart } from './RepsChart'
import { WeightChart } from './WeightChart'
import { CompletionRateChart } from './CompletionRateChart'
import { ExerciseHistory } from './ExerciseHistory'
import { BodyWeightChart } from '@/components/bodyweight/BodyWeightChart'
import { BodyWeightLogForm } from '@/components/bodyweight/BodyWeightLogForm'

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Formats a Date as a short month + day label for chart X-axis ticks, e.g. "Jan 6". */
function formatWeekLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Progress tab: this week's completion at a glance, a chip-picker of exercises with any
 * logged history driving a weight-over-time chart (plus reps/completion/full history
 * below for anyone who wants more detail than the design's single chart), and the body
 * weight trend — including the log-entry form, since this is the only place left to log
 * a new body weight reading now that there's no dedicated Weight tab.
 */
export function ProgressGraphs() {
  const selectedExercise = useUIStore((s) => s.selectedExercise)
  const setSelectedExercise = useUIStore((s) => s.setSelectedExercise)
  const timeRange = useUIStore((s) => s.timeRange)

  const exercises = useExercisesStore((s) => s.exercises)
  const routines = useRoutineStore((s) => s.routines)
  const activeRoutine = selectActiveRoutine(routines)
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const sessions = useWorkoutSessionsStore((s) => s.sessions)
  const bodyWeightLogs = useBodyWeightStore((s) => s.logs)

  const [showLogWeight, setShowLogWeight] = useState(false)

  const today = todayString()

  const weekSummary = activeRoutine ? calculateWeeklySummary(getWeekStart(today), activeRoutine, sessions) : null

  const exercisesWithHistory = useMemo(
    () => exercises.filter((ex) => sessions.some((s) => s.exercises.some((e) => e.exerciseId === ex.id && e.completed))),
    [exercises, sessions]
  )

  // Defaults to the first exercise with logged history, so the chart isn't empty on
  // first visit — the design assumes something is always selected.
  useEffect(() => {
    if (exercisesWithHistory.length === 0) return
    if (selectedExercise && exercisesWithHistory.some((ex) => ex.id === selectedExercise)) return
    setSelectedExercise(exercisesWithHistory[0]!.id)
  }, [exercisesWithHistory, selectedExercise, setSelectedExercise])

  const exerciseName = selectedExercise ? (exercises.find((e) => e.id === selectedExercise)?.name ?? '') : ''

  // Called inside the selector (not selected-then-called-later) so this component
  // re-renders whenever `sessions` changes — see stores/routine.ts for why that
  // distinction matters with Zustand. This one is safe to call inline because
  // getCachedProgressData is memoized (a Map keyed by exercise+range) and returns the
  // *same* object reference on a cache hit — required by useSyncExternalStore, which
  // treats a new reference on every read as a changed value and re-renders forever.
  const progressData = useWorkoutSessionsStore((s) =>
    selectedExercise && activeRoutine
      ? s.getCachedProgressData(selectedExercise, exerciseName, timeRange.start, timeRange.end, activeRoutine)
      : null
  )

  // personalRecord is NOT selected this way: calculatePersonalRecord is a plain,
  // unmemoized function that builds a fresh object every call, so calling it inside a
  // Zustand selector would hit exactly the infinite-loop trap described above. Instead,
  // subscribe to the raw `sessions` array (itself a stable reference across unrelated
  // updates) and derive the record as an ordinary memoized render-body value.
  const personalRecord = useMemo(() => {
    if (!selectedExercise) return null
    const performances = sessions.flatMap((s) => s.exercises).filter((e) => e.exerciseId === selectedExercise)
    return calculatePersonalRecord(performances)
  }, [sessions, selectedExercise])

  const oneRepMax = useMemo(() => {
    if (!selectedExercise) return null
    const performances = sessions.flatMap((s) => s.exercises).filter((e) => e.exerciseId === selectedExercise)
    return bestEstimatedOneRepMax(performances)
  }, [sessions, selectedExercise])

  const muscleBalanceData = useMemo(
    () => calculateMuscleGroupSets(sessions, exercises, addDays(today, -28), today),
    [sessions, exercises, today]
  )

  const repsData = (progressData?.weeklyData ?? []).map((w) => ({
    weekLabel: formatWeekLabel(w.weekStartDate),
    averageReps: w.averageReps,
  }))
  const weightData = (progressData?.weeklyData ?? []).map((w) => ({
    weekLabel: formatWeekLabel(w.weekStartDate),
    averageWeight: w.averageWeight === 0 ? null : w.averageWeight,
  }))
  const completionData = (progressData?.weeklyData ?? []).map((w) => ({
    weekLabel: formatWeekLabel(w.weekStartDate),
    completionRate: w.totalAssigned === 0 ? 0 : Math.round((w.completionCount / w.totalAssigned) * 100),
  }))

  const sessionDurations = sessions.map((s) => s.durationSeconds).filter((d): d is number => d != null)
  const avgSessionMinutes =
    sessionDurations.length > 0
      ? Math.round(sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length / 60)
      : null

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h6 className="text-ink-muted text-sm">This week</h6>
          {avgSessionMinutes !== null && (
            <span className="text-ink-faint text-xs">Avg session: {avgSessionMinutes}m</span>
          )}
        </div>
        <WeeklyBars breakdown={weekSummary?.dailyBreakdown ?? {}} today={getDayOfWeek(today)} />
      </div>

      <div>
        <h6 className="text-ink-muted text-sm mb-2.5">Muscle balance (last 4 weeks)</h6>
        <MuscleBalance data={muscleBalanceData} />
      </div>

      <div>
        <h6 className="text-ink-muted text-sm mb-2.5">Exercise progress</h6>

        {exercisesWithHistory.length === 0 ? (
          <div className="card-pad text-center py-12">
            <div className="empty-blob animate-float">📈</div>
            <p className="text-ink font-semibold">No exercises logged yet</p>
            <p className="text-ink-muted text-sm mt-1">Complete a workout in Train to see progress here.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-1">
              {exercisesWithHistory.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => setSelectedExercise(ex.id)}
                  aria-pressed={selectedExercise === ex.id}
                  className={
                    selectedExercise === ex.id
                      ? 'flex-none px-3.5 py-1.5 rounded-full text-xs font-semibold bg-accent text-canvas border border-accent'
                      : 'flex-none px-3.5 py-1.5 rounded-full text-xs font-semibold bg-transparent text-ink-muted border border-surface-border'
                  }
                >
                  {ex.name}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              {personalRecord && (personalRecord.maxWeight !== null || personalRecord.maxReps !== null) && (
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="stat-tile !p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted flex items-center gap-1">
                      🏆 Best Weight
                    </p>
                    {personalRecord.maxWeight !== null ? (
                      <p className="text-xl font-extrabold text-ink mt-1">
                        {formatWeight(personalRecord.maxWeight, weightUnit)}
                        <span className="text-sm text-ink-muted font-semibold">{weightUnit}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-ink-faint mt-1">No weight logged</p>
                    )}
                    {personalRecord.maxWeightReps && (
                      <p className="text-xs text-ink-muted mt-0.5">× {personalRecord.maxWeightReps} reps</p>
                    )}
                  </div>
                  <div className="stat-tile !p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted flex items-center gap-1">
                      🏆 Best Reps
                    </p>
                    {personalRecord.maxReps !== null ? (
                      <p className="text-xl font-extrabold text-ink mt-1">{personalRecord.maxReps}</p>
                    ) : (
                      <p className="text-sm text-ink-faint mt-1">No reps logged</p>
                    )}
                    {personalRecord.maxRepsWeight != null && (
                      <p className="text-xs text-ink-muted mt-0.5">
                        @ {formatWeight(personalRecord.maxRepsWeight, weightUnit)}{weightUnit}
                      </p>
                    )}
                  </div>
                  <div className="stat-tile !p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted flex items-center gap-1">
                      Est. 1RM
                    </p>
                    {oneRepMax !== null ? (
                      <p className="text-xl font-extrabold text-ink mt-1">
                        {formatWeight(oneRepMax.estimated, weightUnit)}
                        <span className="text-sm text-ink-muted font-semibold">{weightUnit}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-ink-faint mt-1">No weight logged</p>
                    )}
                    {oneRepMax !== null && (
                      <p className="text-xs text-ink-muted mt-0.5">
                        from {formatWeight(oneRepMax.weightKg, weightUnit)}
                        {weightUnit} × {oneRepMax.reps}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <WeightChart data={weightData} exerciseName={exerciseName} />
              <RepsChart data={repsData} exerciseName={exerciseName} />
              <CompletionRateChart data={completionData} />
              {selectedExercise && <ExerciseHistory exerciseId={selectedExercise} />}
            </div>
          </>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h6 className="text-ink-muted text-sm">Body weight</h6>
          <button className="text-accent-400 text-xs font-semibold" onClick={() => setShowLogWeight((v) => !v)}>
            {showLogWeight ? 'Cancel' : '+ Log weight'}
          </button>
        </div>
        {showLogWeight && (
          <div className="mb-3">
            <BodyWeightLogForm />
          </div>
        )}
        <BodyWeightChart logs={bodyWeightLogs} />
      </div>
    </div>
  )
}
