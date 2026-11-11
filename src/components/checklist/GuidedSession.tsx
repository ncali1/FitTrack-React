import { useEffect, useState } from 'react'
import { Shuffle } from 'lucide-react'
import type { Exercise, ExercisePerformance, WorkoutSession } from '@/types'
import { getExerciseHistory } from '@/utils/calculations'
import { suggestNextPerformance } from '@/utils/progressiveOverload'
import { secondsUntil } from '@/stores/restTimer'
import { armRestAlert, disarmRestAlert, fireRestAlert } from '@/services/restAlert'
import { useKeepAwake } from '@/hooks/useKeepAwake'
import { useSettingsStore } from '@/stores/settings'
import { useGuidedSessionStore } from '@/stores/guidedSession'
import { PerformanceForm } from './PerformanceForm'
import { SwapExerciseSheet } from './SwapExerciseSheet'

type Phase = 'logging' | 'resting'

/**
 * Walks through a list of exercise groups — log performance, rest, repeat — rather than
 * the checklist's tap-any-item-in-any-order flow. A group with more than one exercise is
 * a superset: its members are logged back-to-back with *no* rest between them, resting
 * only once the whole group is done (see SessionGroupPicker, which is how groups get
 * formed — every exercise defaults to its own singleton group, so an all-singleton input
 * reproduces the original one-at-a-time flow exactly).
 *
 * Keeps its own local rest countdown independent of the app-wide `restTimerStore`/floating
 * `RestTimer` widget (used by the ad-hoc checklist flow) so the two don't fight over one
 * full-screen vs. one corner-widget presentation. Like that store, the countdown is
 * derived from an end timestamp rather than decremented, so it stays correct if the app
 * is backgrounded or the phone locks mid-rest; the screen is kept awake for as long as
 * the session is on screen (unless turned off in Preferences).
 *
 * Which exercise you're on and when the current rest ends live in `guidedSessionStore`,
 * not here, so the session survives this component unmounting (every tab switch does
 * that) and the app being killed in the background. "End session" is the way out.
 *
 * The exercise you're on can be swapped for a same-muscle alternative (machine taken,
 * bench busy) without leaving the session; it takes over that slot, superset and all.
 */
export function GuidedSession({
  groups,
  sessions,
  restDuration,
  onLogExercise,
  onSwapExercise,
  onComplete,
  onExit,
}: {
  groups: Exercise[][]
  /** All workout sessions, used to suggest each exercise's next weight/reps from its history. */
  sessions: WorkoutSession[]
  restDuration: number
  onLogExercise: (
    exercise: Exercise,
    performance: Omit<ExercisePerformance, 'exerciseId' | 'timestamp'>
  ) => void | Promise<void>
  /** Replaces `from` with `to` — the parent passes back `groups` with the swap applied. */
  onSwapExercise: (from: Exercise, to: Exercise) => void | Promise<void>
  onComplete: () => void
  /** Abandons the rest of the session; what has been logged so far is already saved. */
  onExit: () => void
}) {
  const [showSwap, setShowSwap] = useState(false)
  const position = useGuidedSessionStore((s) => s.session)
  const advance = useGuidedSessionStore((s) => s.advance)
  const startRest = useGuidedSessionStore((s) => s.startRest)
  const groupIndex = position?.groupIndex ?? 0
  const exerciseIndexInGroup = position?.exerciseIndex ?? 0
  /** Unix milliseconds at which the current rest ends; `null` outside the resting phase. */
  const restEndsAt = position?.restEndsAt ?? null
  const phase: Phase = restEndsAt === null ? 'logging' : 'resting'
  const [restRemaining, setRestRemaining] = useState(() =>
    restEndsAt === null ? restDuration : secondsUntil(restEndsAt)
  )

  useKeepAwake(useSettingsStore((s) => s.keepScreenAwake))

  const totalExercises = groups.reduce((sum, g) => sum + g.length, 0)
  const currentGroup = groups[groupIndex] ?? []
  const currentExercise = currentGroup[exerciseIndexInGroup]
  const isLastExerciseInGroup = exerciseIndexInGroup === currentGroup.length - 1
  const isLastGroup = groupIndex === groups.length - 1
  const isVeryLast = isLastExerciseInGroup && isLastGroup

  useEffect(() => {
    if (restEndsAt === null) return
    // Armed here rather than where the rest starts, so a rest picked up again after the
    // app was reloaded mid-workout still alerts.
    if (restEndsAt > Date.now()) armRestAlert(restEndsAt)
    const tick = () => {
      const remaining = secondsUntil(restEndsAt)
      if (remaining <= 0) {
        fireRestAlert()
        advance()
      } else {
        setRestRemaining(remaining)
      }
    }
    tick()
    const interval = setInterval(tick, 250)
    // Timers are throttled while hidden — catch up the instant the app is visible again.
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [restEndsAt, advance])

  const handleSubmit = async (performance: Omit<ExercisePerformance, 'exerciseId' | 'timestamp'>) => {
    if (!currentExercise) return
    await onLogExercise(currentExercise, performance)

    if (isVeryLast) {
      onComplete()
    } else if (isLastExerciseInGroup) {
      // Group finished — a real rest follows. The exercise just completed (the group's
      // last member) may have its own custom rest override.
      const restSeconds = currentExercise.restSeconds ?? restDuration
      setRestRemaining(restSeconds)
      startRest(Date.now() + restSeconds * 1000)
    } else {
      // More members in this same group — straight on, no rest.
      advance()
    }
  }

  const handleSwap = async (replacement: Exercise) => {
    if (!currentExercise) return
    setShowSwap(false)
    await onSwapExercise(currentExercise, replacement)
  }

  const skipRest = () => {
    disarmRestAlert()
    advance()
  }

  const handleExit = () => {
    disarmRestAlert()
    onExit()
  }

  if (!currentExercise) return null

  // 0-based count of exercises in earlier groups, plus how far into the current group —
  // valid in both phases since exerciseIndexInGroup/groupIndex only change via advance(),
  // which for a mid-group exercise fires immediately (no rest) and for a group's last
  // exercise fires only once the rest countdown ends, not right when resting begins.
  const flatIndexBeforeCurrentGroup = groups.slice(0, groupIndex).reduce((sum, g) => sum + g.length, 0)
  const currentPosition1Based = flatIndexBeforeCurrentGroup + exerciseIndexInGroup + 1
  const completedCount = flatIndexBeforeCurrentGroup + exerciseIndexInGroup + (phase === 'resting' ? 1 : 0)
  const progressPct = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0
  const nextGroup = groups[groupIndex + 1]
  const suggestion = suggestNextPerformance(getExerciseHistory(currentExercise.id, sessions))

  const submitLabel = isVeryLast ? 'Finish workout' : isLastExerciseInGroup ? 'Complete & rest' : 'Next in superset'

  return (
    <div className="space-y-5">
      <div>
        <div className="flex justify-between eyebrow mb-1.5">
          <span>
            Exercise {currentPosition1Based} of {totalExercises}
          </span>
          <span className="num">{progressPct}%</span>
        </div>
        <div className="h-1.5 bg-canvas-700 overflow-hidden">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {phase === 'resting' ? (
        <div className="flex flex-col items-center gap-3.5 py-16">
          <div className="eyebrow text-accent-400">Rest</div>
          <div className="num text-8xl font-semibold text-ink leading-none">
            {restRemaining}
            <span className="text-3xl text-ink-faint">s</span>
          </div>
          {nextGroup && (
            <div className="text-sm text-ink-muted">Up next: {nextGroup.map((ex) => ex.name).join(' + ')}</div>
          )}
          <button onClick={skipRest} className="btn-secondary mt-2">
            Skip rest
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="eyebrow text-accent-400">
              {currentGroup.length > 1 && `Superset · ${exerciseIndexInGroup + 1} of ${currentGroup.length}`}
            </div>
            <button type="button" onClick={() => setShowSwap(true)} className="btn-secondary min-h-11">
              <Shuffle size={16} strokeWidth={2} />
              Swap exercise
            </button>
          </div>
          {showSwap && (
            <SwapExerciseSheet
              exercise={currentExercise}
              excludeNames={groups.flat().map((ex) => ex.name)}
              onPick={handleSwap}
              onCancel={() => setShowSwap(false)}
            />
          )}
          <PerformanceForm
            key={currentExercise.id}
            exerciseId={currentExercise.id}
            exerciseName={currentExercise.name}
            targetSets={currentExercise.targetSets}
            targetReps={currentExercise.targetReps}
            notes={currentExercise.notes}
            suggestion={suggestion}
            onSubmit={handleSubmit}
            inline
            submitLabel={submitLabel}
          />
        </>
      )}

      <button type="button" onClick={handleExit} className="btn-ghost w-full">
        End session
      </button>
    </div>
  )
}
