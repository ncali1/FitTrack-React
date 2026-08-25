import { useMemo } from 'react'
import { useUIStore } from '@/stores/ui'
import { useExercisesStore } from '@/stores/exercises'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useRoutineStore, selectActiveRoutine } from '@/stores/routine'
import { useSettingsStore } from '@/stores/settings'
import { calculatePersonalRecord } from '@/utils/personalRecords'
import { formatWeight } from '@/utils/units'
import { GraphExerciseSelector } from './GraphExerciseSelector'
import { TimeRangeSelector } from './TimeRangeSelector'
import { RepsChart } from './RepsChart'
import { WeightChart } from './WeightChart'
import { CompletionRateChart } from './CompletionRateChart'
import { ExerciseHistory } from './ExerciseHistory'

/** Formats a Date as a short month + day label for chart X-axis ticks, e.g. "Jan 6". */
function formatWeekLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Displays exercise progress charts over a selectable time range: RepsChart,
 * WeightChart, CompletionRateChart, plus a chronological ExerciseHistory list, once an
 * exercise is selected.
 */
export function ProgressGraphs() {
  const selectedExercise = useUIStore((s) => s.selectedExercise)
  const setSelectedExercise = useUIStore((s) => s.setSelectedExercise)
  const timeRange = useUIStore((s) => s.timeRange)
  const setTimeRange = useUIStore((s) => s.setTimeRange)

  const exercises = useExercisesStore((s) => s.exercises)
  const routines = useRoutineStore((s) => s.routines)
  const activeRoutine = selectActiveRoutine(routines)
  const weightUnit = useSettingsStore((s) => s.weightUnit)

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
  const sessions = useWorkoutSessionsStore((s) => s.sessions)
  const personalRecord = useMemo(() => {
    if (!selectedExercise) return null
    const performances = sessions.flatMap((s) => s.exercises).filter((e) => e.exerciseId === selectedExercise)
    return calculatePersonalRecord(performances)
  }, [sessions, selectedExercise])

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

  return (
    <div className="space-y-5">
      {/* Header with selectors */}
      <div className="card-pad">
        <h2 className="text-ink">Progress</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="min-w-48 flex-1">
            <label className="field-label">Exercise</label>
            <GraphExerciseSelector value={selectedExercise} onChange={setSelectedExercise} />
          </div>
          <div className="flex-1">
            <label className="field-label">Time Range</label>
            <TimeRangeSelector value={timeRange} onChange={(v) => setTimeRange(v.start, v.end)} />
          </div>
        </div>
      </div>

      {!selectedExercise ? (
        <div className="card-pad text-center py-14">
          <div className="empty-blob animate-float">📈</div>
          <p className="text-ink font-semibold">Select an exercise to view progress</p>
        </div>
      ) : (
        <>
          {/* Personal records summary */}
          {personalRecord && (personalRecord.maxWeight !== null || personalRecord.maxReps !== null) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="stat-tile">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted flex items-center gap-1">
                  🏆 Best Weight
                </p>
                {personalRecord.maxWeight !== null ? (
                  <p className="text-2xl font-extrabold text-ink mt-1">
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
              <div className="stat-tile">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted flex items-center gap-1">
                  🏆 Best Reps
                </p>
                {personalRecord.maxReps !== null ? (
                  <p className="text-2xl font-extrabold text-ink mt-1">{personalRecord.maxReps}</p>
                ) : (
                  <p className="text-sm text-ink-faint mt-1">No reps logged</p>
                )}
                {personalRecord.maxRepsWeight != null && (
                  <p className="text-xs text-ink-muted mt-0.5">
                    @ {formatWeight(personalRecord.maxRepsWeight, weightUnit)}{weightUnit}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-5">
            <RepsChart data={repsData} exerciseName={exerciseName} />
            <WeightChart data={weightData} exerciseName={exerciseName} />
            <CompletionRateChart data={completionData} />
            <ExerciseHistory exerciseId={selectedExercise} />
          </div>
        </>
      )}
    </div>
  )
}
