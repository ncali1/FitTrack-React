import type { ExercisePerformance } from '@/types'
import { useSettingsStore } from '@/stores/settings'
import { formatWeight } from '@/utils/units'

export interface ChecklistItem {
  exerciseId: string
  exerciseName: string
  targetSets: number
  targetReps: number
  targetMuscleGroups: string[]
  notes?: string
  completed: boolean
  performance?: ExercisePerformance
  /** True when this logged performance currently holds the exercise's all-time max weight. */
  isWeightPR?: boolean
  /** True when this logged performance currently holds the exercise's all-time max reps. */
  isRepsPR?: boolean
}

/**
 * Renders a list of ChecklistItem rows, each showing the exercise name, targets,
 * completion state, and logged performance summary (weight shown in the user's
 * preferred unit).
 */
export function ChecklistItems({
  items,
  onToggle,
}: {
  items: ChecklistItem[]
  onToggle: (exerciseId: string, completed: boolean) => void
}) {
  const weightUnit = useSettingsStore((s) => s.weightUnit)

  if (items.length === 0) {
    return <div className="text-center py-10 text-ink-muted text-sm">No exercises assigned for this day.</div>
  }

  return (
    <ol className="border-y border-surface-border divide-y divide-surface-border">
      {items.map((item, index) => (
        <li key={item.exerciseId} className="flex items-start gap-3 py-3.5">
          <span className="num text-xs text-ink-faint w-5 pt-1.5">{String(index + 1).padStart(2, '0')}</span>
          {/* Checkbox */}
          <button
            id={`exercise-${item.exerciseId}`}
            type="button"
            role="checkbox"
            aria-checked={item.completed}
            onClick={() => onToggle(item.exerciseId, !item.completed)}
            className={
              item.completed
                ? 'order-last w-8 h-8 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition-colors bg-mark-500 border-mark-500 text-canvas-950'
                : 'order-last w-8 h-8 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition-colors border-ink-faint hover:border-ink'
            }
          >
            {item.completed && (
              <svg
                key={item.performance?.timestamp ?? 'checked'}
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="square"
                strokeLinejoin="miter"
                className="animate-check-bounce"
              >
                <path d="m5 12 5 5L19 8" />
              </svg>
            )}
          </button>

          {/* Exercise info */}
          <label
            htmlFor={`exercise-${item.exerciseId}`}
            className="flex-1 cursor-pointer"
            onClick={() => onToggle(item.exerciseId, !item.completed)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`font-semibold ${item.completed ? 'line-through decoration-mark-500 decoration-2 text-ink-faint' : 'text-ink'}`}>
                {item.exerciseName}
              </span>
            </div>
            <div className="text-xs text-ink-muted mt-1">
              <span className="num">
                {item.targetSets}×{item.targetReps}
              </span>
              {item.targetMuscleGroups.length > 0 && <span className="ml-1">· {item.targetMuscleGroups.join(', ')}</span>}
            </div>
            {item.notes && <div className="text-xs text-ink-faint mt-1 line-clamp-1">{item.notes}</div>}
            {/* Logged performance summary */}
            {item.completed && item.performance && (
              <div className="text-xs text-mark-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="num">
                  {item.performance.actualSets} sets × {item.performance.actualReps} reps
                  {item.performance.weight != null && (
                    <> @ {formatWeight(item.performance.weight, weightUnit)}{weightUnit}</>
                  )}{' '}
                  · {item.performance.difficultyLevel}
                  {item.performance.rpe != null && <> · RPE {item.performance.rpe}</>}
                </span>
                {(item.isWeightPR || item.isRepsPR) && <span className="badge-mark">PR</span>}
                {item.performance.isWarmup && <span className="badge-muted">Warm-up</span>}
              </div>
            )}
          </label>
        </li>
      ))}
    </ol>
  )
}
