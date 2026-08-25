import type { ExercisePerformance } from '@/types'
import { useSettingsStore } from '@/stores/settings'
import { formatWeight } from '@/utils/units'

export interface ChecklistItem {
  exerciseId: string
  exerciseName: string
  targetSets: number
  targetReps: number
  targetMuscleGroups: string[]
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
    <div className="space-y-2.5 stagger-children">
      {items.map((item) => (
        <div key={item.exerciseId} className="flex items-start gap-3 p-4 card card-hover animate-pop-in">
          {/* Checkbox */}
          <button
            id={`exercise-${item.exerciseId}`}
            type="button"
            role="checkbox"
            aria-checked={item.completed}
            onClick={() => onToggle(item.exerciseId, !item.completed)}
            className={
              item.completed
                ? 'mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all active:scale-90 bg-lime-500 border-lime-500 shadow-[0_0_0_4px_rgba(198,255,94,0.15)]'
                : 'mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all active:scale-90 border-surface-border hover:border-ink-faint'
            }
          >
            {item.completed && (
              <svg
                key={item.performance?.timestamp ?? 'checked'}
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="#0a0b0f"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
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
              <span className={`font-semibold text-sm ${item.completed ? 'line-through text-ink-faint' : 'text-ink'}`}>
                {item.exerciseName}
              </span>
              {item.completed && <span className="badge-lime flex-shrink-0">Done</span>}
            </div>
            <div className="text-xs text-ink-muted mt-1">
              {item.targetSets} sets × {item.targetReps} reps
              {item.targetMuscleGroups.length > 0 && <span className="ml-1">· {item.targetMuscleGroups.join(', ')}</span>}
            </div>
            {/* Logged performance summary */}
            {item.completed && item.performance && (
              <div className="text-xs text-accent-400 mt-1.5 font-medium flex items-center gap-1.5 flex-wrap">
                <span>
                  {item.performance.actualSets} sets × {item.performance.actualReps} reps
                  {item.performance.weight != null && (
                    <> @ {formatWeight(item.performance.weight, weightUnit)}{weightUnit}</>
                  )}{' '}
                  · {item.performance.difficultyLevel}
                </span>
                {(item.isWeightPR || item.isRepsPR) && <span className="badge-lime !py-0.5">🏆 PR</span>}
              </div>
            )}
          </label>
        </div>
      ))}
    </div>
  )
}
