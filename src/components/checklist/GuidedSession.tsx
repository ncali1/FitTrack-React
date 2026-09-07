import { useCallback, useEffect, useState } from 'react'
import type { Exercise, ExercisePerformance, WorkoutSession } from '@/types'
import { getExerciseHistory } from '@/utils/calculations'
import { suggestNextPerformance } from '@/utils/progressiveOverload'
import { PerformanceForm } from './PerformanceForm'

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
 * full-screen vs. one corner-widget presentation.
 */
export function GuidedSession({
  groups,
  sessions,
  restDuration,
  onLogExercise,
  onComplete,
}: {
  groups: Exercise[][]
  /** All workout sessions, used to suggest each exercise's next weight/reps from its history. */
  sessions: WorkoutSession[]
  restDuration: number
  onLogExercise: (
    exercise: Exercise,
    performance: Omit<ExercisePerformance, 'exerciseId' | 'timestamp'>
  ) => void | Promise<void>
  onComplete: () => void
}) {
  const [groupIndex, setGroupIndex] = useState(0)
  const [exerciseIndexInGroup, setExerciseIndexInGroup] = useState(0)
  const [phase, setPhase] = useState<Phase>('logging')
  const [restRemaining, setRestRemaining] = useState(restDuration)

  const totalExercises = groups.reduce((sum, g) => sum + g.length, 0)
  const currentGroup = groups[groupIndex] ?? []
  const currentExercise = currentGroup[exerciseIndexInGroup]
  const isLastExerciseInGroup = exerciseIndexInGroup === currentGroup.length - 1
  const isLastGroup = groupIndex === groups.length - 1
  const isVeryLast = isLastExerciseInGroup && isLastGroup

  /** Moves to the next exercise within the current group, or the next group's first. */
  const advance = useCallback(() => {
    if (!isLastExerciseInGroup) {
      setExerciseIndexInGroup((i) => i + 1)
    } else {
      setGroupIndex((g) => g + 1)
      setExerciseIndexInGroup(0)
    }
  }, [isLastExerciseInGroup])

  useEffect(() => {
    if (phase !== 'resting') return
    const timeout = setTimeout(() => {
      if (restRemaining <= 1) {
        setPhase('logging')
        advance()
      } else {
        setRestRemaining((r) => r - 1)
      }
    }, 1000)
    return () => clearTimeout(timeout)
  }, [phase, restRemaining, advance])

  const handleSubmit = async (performance: Omit<ExercisePerformance, 'exerciseId' | 'timestamp'>) => {
    if (!currentExercise) return
    await onLogExercise(currentExercise, performance)

    if (isVeryLast) {
      onComplete()
    } else if (isLastExerciseInGroup) {
      // Group finished — a real rest follows.
      setRestRemaining(restDuration)
      setPhase('resting')
    } else {
      // More members in this same group — straight on, no rest.
      advance()
    }
  }

  const skipRest = () => {
    setPhase('logging')
    advance()
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
        <div className="flex justify-between text-xs text-ink-muted mb-1.5">
          <span>
            Exercise {currentPosition1Based} of {totalExercises}
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-1 rounded-full bg-canvas-800 overflow-hidden">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {phase === 'resting' ? (
        <div className="flex flex-col items-center gap-3.5 py-16">
          <div className="text-xs font-semibold uppercase tracking-widest text-accent-400">Rest</div>
          <div className="text-6xl font-semibold text-ink font-heading tabular-nums">{restRemaining}s</div>
          {nextGroup && (
            <div className="text-sm text-ink-muted">Up next: {nextGroup.map((ex) => ex.name).join(' + ')}</div>
          )}
          <button onClick={skipRest} className="btn-secondary mt-2">
            Skip rest
          </button>
        </div>
      ) : (
        <>
          {currentGroup.length > 1 && (
            <div className="text-xs font-semibold uppercase tracking-wide text-accent-400">
              Superset · {exerciseIndexInGroup + 1} of {currentGroup.length}
            </div>
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
    </div>
  )
}
