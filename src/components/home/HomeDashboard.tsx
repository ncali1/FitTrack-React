import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useRoutineStore } from '@/stores/routine'
import { useActiveProgram } from '@/hooks/useActiveProgram'
import { useExercisesStore } from '@/stores/exercises'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useBodyWeightStore } from '@/stores/bodyWeight'
import { useSettingsStore } from '@/stores/settings'
import { useUIStore } from '@/stores/ui'
import {
  getDayOfWeek,
  getWeekStart,
  getPlannedExerciseIds,
  calculateWeeklySummary,
  calculateStreak,
  getIsoWeek,
  todayString,
} from '@/utils/calculations'
import { formatWeight } from '@/utils/units'

/**
 * Landing "Home" tab, laid out like the top of a logbook page: a date/week stamp, today's
 * numbered exercise list with target sets×reps (or a rest-day note), and a ruled row of
 * three stats (training streak, this week's completion, latest body weight).
 * Reuses the same stores/calculations as Train/Progress rather than tracking its own
 * copy of any of this data.
 */
export function HomeDashboard() {
  const activeRoutine = useActiveProgram()
  const exercises = useExercisesStore((s) => s.exercises)
  const sessions = useWorkoutSessionsStore((s) => s.sessions)
  const assignExercise = useRoutineStore((s) => s.assignExercise)
  const logs = useBodyWeightStore((s) => s.logs)
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const setActiveTab = useUIStore((s) => s.setActiveTab)

  const [repeating, setRepeating] = useState(false)

  const todayStr = todayString()
  const todayExerciseIds = getPlannedExerciseIds(
    todayStr,
    activeRoutine,
    sessions.find((s) => s.date === todayStr)
  )
  const todayExercises = todayExerciseIds
    .map((id) => exercises.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => e !== undefined)
  const isRestDay = todayExercises.length === 0

  const lastWorkoutSession =
    [...sessions]
      .filter((s) => s.date < todayStr && s.exercises.some((e) => e.completed))
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null

  const handleRepeatLastWorkout = async () => {
    if (!lastWorkoutSession) return
    setRepeating(true)
    try {
      const exerciseIds = [
        ...new Set(lastWorkoutSession.exercises.filter((e) => e.completed).map((e) => e.exerciseId)),
      ].filter((id) => exercises.some((ex) => ex.id === id) && !todayExerciseIds.includes(id))

      for (const id of exerciseIds) {
        await assignExercise(getDayOfWeek(todayStr), id)
      }
      toast.success("Last workout's exercises added to today's plan")
    } catch (err) {
      console.error('Failed to repeat last workout:', err)
      toast.error('Failed to add exercises. Please try again.')
    } finally {
      setRepeating(false)
    }
  }

  const weekSummary = activeRoutine
    ? calculateWeeklySummary(getWeekStart(todayStr), activeRoutine, sessions)
    : null
  const weekCompletionPct = weekSummary?.completionPercentage ?? 0

  const streak = calculateStreak(activeRoutine, sessions, todayStr)

  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  const latestLog = sortedLogs.at(-1) ?? null
  const previousLog = sortedLogs.at(-2) ?? null
  const bodyWeightDisplay = latestLog ? formatWeight(latestLog.weightKg, weightUnit) : '—'
  const deltaKg = latestLog && previousLog ? latestLog.weightKg - previousLog.weightKg : null
  const deltaDisplay =
    deltaKg === null ? weightUnit : `${deltaKg >= 0 ? '+' : ''}${formatWeight(deltaKg, weightUnit)} ${weightUnit}`

  const dateStamp = new Date()
    .toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
    .replace(/,/g, '')
  const weekNumber = getIsoWeek(todayStr)

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-baseline justify-between eyebrow">
          <span>{dateStamp}</span>
          <span>Wk {weekNumber}</span>
        </div>
        <div className="rule-heavy mt-2" />
      </header>

      {isRestDay ? (
        <section aria-labelledby="today-heading">
          <h1 id="today-heading" className="text-4xl">
            Rest day
          </h1>
          <p className="eyebrow mt-2">Nothing scheduled · recovery is part of the plan</p>
          {lastWorkoutSession && (
            <>
              <div className="rule mt-5" />
              <button className="btn-secondary w-full mt-5" disabled={repeating} onClick={handleRepeatLastWorkout}>
                {repeating ? 'Adding...' : 'Repeat last workout'}
              </button>
            </>
          )}
        </section>
      ) : (
        <section aria-labelledby="today-heading">
          <h1 id="today-heading" className="text-4xl">
            Today's training
          </h1>
          <p className="eyebrow mt-2">
            {todayExercises.length} exercise{todayExercises.length === 1 ? '' : 's'}
          </p>
          <ol className="mt-4 border-y border-surface-border divide-y divide-surface-border">
            {todayExercises.map((ex, i) => (
              <li key={ex.id} className="flex items-baseline gap-3 py-2.5">
                <span className="num text-xs text-ink-faint w-5">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex-1 min-w-0 truncate text-ink font-medium">{ex.name}</span>
                <span className="num text-sm text-ink-muted">
                  {ex.targetSets}×{ex.targetReps}
                </span>
              </li>
            ))}
          </ol>
          <button className="btn-primary w-full mt-5 !justify-between" onClick={() => setActiveTab('train')}>
            Start workout
            <ArrowRight size={18} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </section>
      )}

      <dl className="grid grid-cols-3 border-y border-surface-border divide-x divide-surface-border">
        <div className="py-3 pr-3">
          <dt className="eyebrow">Streak</dt>
          <dd className="num text-2xl font-semibold text-ink mt-1">{streak}</dd>
          <dd className="text-xs text-ink-faint">days</dd>
        </div>
        <div className="py-3 px-3">
          <dt className="eyebrow">Week</dt>
          <dd className="num text-2xl font-semibold text-ink mt-1">{weekCompletionPct}%</dd>
          <dd className="text-xs text-ink-faint">done</dd>
        </div>
        <div className="py-3 pl-3">
          <dt className="eyebrow">Body wt</dt>
          <dd className="num text-2xl font-semibold text-ink mt-1">{bodyWeightDisplay}</dd>
          <dd className="num text-xs text-ink-faint">{deltaDisplay}</dd>
        </div>
      </dl>
    </div>
  )
}
