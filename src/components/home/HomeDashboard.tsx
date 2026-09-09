import { useState } from 'react'
import { toast } from 'sonner'
import { useRoutineStore, selectActiveRoutine } from '@/stores/routine'
import { useExercisesStore } from '@/stores/exercises'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useBodyWeightStore } from '@/stores/bodyWeight'
import { useSettingsStore } from '@/stores/settings'
import { useUIStore } from '@/stores/ui'
import { getDayOfWeek, getWeekStart, calculateWeeklySummary, calculateStreak } from '@/utils/calculations'
import { formatWeight } from '@/utils/units'

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Landing "Home" tab: a greeting, a card for today's plan (or a rest-day message), and
 * three quick stats (training streak, this week's completion, latest body weight).
 * Reuses the same stores/calculations as Train/Progress rather than tracking its own
 * copy of any of this data.
 */
export function HomeDashboard() {
  const routines = useRoutineStore((s) => s.routines)
  const activeRoutine = selectActiveRoutine(routines)
  const exercises = useExercisesStore((s) => s.exercises)
  const sessions = useWorkoutSessionsStore((s) => s.sessions)
  const assignExercise = useRoutineStore((s) => s.assignExercise)
  const logs = useBodyWeightStore((s) => s.logs)
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const setActiveTab = useUIStore((s) => s.setActiveTab)

  const [repeating, setRepeating] = useState(false)

  const todayStr = todayString()
  const todayExerciseIds = activeRoutine?.weeklyAssignments[getDayOfWeek(todayStr)] ?? []
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
  const bodyWeightDisplay = latestLog ? `${formatWeight(latestLog.weightKg, weightUnit)} ${weightUnit}` : '—'
  const deltaKg = latestLog && previousLog ? latestLog.weightKg - previousLog.weightKg : null
  const deltaDisplay =
    deltaKg === null ? 'no data yet' : `${deltaKg >= 0 ? '+' : ''}${formatWeight(deltaKg, weightUnit)} ${weightUnit}`

  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.'
  const greeting = `${timeGreeting} ${isRestDay ? 'Take it easy today.' : 'Ready to train?'}`

  return (
    <div className="space-y-5">
      <p className="text-ink-muted text-sm">{greeting}</p>

      {isRestDay ? (
        <div className="card-pad">
          <div className="badge-muted mb-2">Today</div>
          <h3 className="text-ink">Rest day</h3>
          <p className="text-ink-muted text-sm mt-1">No training scheduled — recovery is part of the plan.</p>
          {lastWorkoutSession && (
            <button className="btn-secondary w-full mt-3" disabled={repeating} onClick={handleRepeatLastWorkout}>
              {repeating ? 'Adding...' : 'Repeat last workout'}
            </button>
          )}
        </div>
      ) : (
        <div className="card-pad space-y-3">
          <div className="flex items-center justify-between">
            <div className="badge-muted">Today</div>
            <span className="text-ink-faint text-xs">
              {todayExercises.length} exercise{todayExercises.length === 1 ? '' : 's'}
            </span>
          </div>
          <h3 className="text-ink">Today's training</h3>
          <div className="flex flex-wrap gap-1.5">
            {todayExercises.map((ex) => (
              <span key={ex.id} className="badge-muted">
                {ex.name}
              </span>
            ))}
          </div>
          <button className="btn-primary w-full mt-1" onClick={() => setActiveTab('train')}>
            Start workout
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        <div className="stat-tile !p-3">
          <div className="text-xl font-semibold text-ink">{streak}</div>
          <div className="text-[11px] text-ink-muted">day streak</div>
        </div>
        <div className="stat-tile !p-3">
          <div className="text-xl font-semibold text-ink">{weekCompletionPct}%</div>
          <div className="text-[11px] text-ink-muted">week done</div>
        </div>
        <div className="stat-tile !p-3">
          <div className="text-xl font-semibold text-ink">{bodyWeightDisplay}</div>
          <div className="text-[11px] text-ink-muted">{deltaDisplay}</div>
        </div>
      </div>
    </div>
  )
}
