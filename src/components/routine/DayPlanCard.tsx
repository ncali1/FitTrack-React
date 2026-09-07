import { X, Plus } from 'lucide-react'
import type { Exercise } from '@/types'

/**
 * One day's card in the plan builder: assigned-exercise chips (each removable), and an
 * expandable toggle-grid of the user's whole exercise library to add more.
 */
export function DayPlanCard({
  label,
  assignedExercises,
  allExercises,
  expanded,
  onToggleExpand,
  onAdd,
  onRemove,
}: {
  label: string
  assignedExercises: Exercise[]
  allExercises: Exercise[]
  expanded: boolean
  onToggleExpand: () => void
  onAdd: (exerciseId: string) => void
  onRemove: (exerciseId: string) => void
}) {
  const assignedIds = new Set(assignedExercises.map((ex) => ex.id))

  return (
    <div className="card p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{label}</span>
        <button onClick={onToggleExpand} className="btn-ghost !px-2 !py-1 text-xs">
          {expanded ? (
            'Done'
          ) : (
            <>
              <Plus size={12} strokeWidth={2.5} />
              Add
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {assignedExercises.map((ex) => (
          <span key={ex.id} className="badge-muted !gap-1.5">
            {ex.name}
            <button onClick={() => onRemove(ex.id)} aria-label={`Remove ${ex.name}`}>
              <X size={10} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        {assignedExercises.length === 0 && <span className="text-xs text-ink-faint">Rest day</span>}
      </div>

      {expanded && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-surface-border">
          {allExercises.length === 0 ? (
            <span className="text-xs text-ink-faint">No exercises yet — add some from Library first.</span>
          ) : (
            allExercises.map((ex) => {
              const active = assignedIds.has(ex.id)
              return (
                <button
                  key={ex.id}
                  onClick={() => (active ? onRemove(ex.id) : onAdd(ex.id))}
                  aria-pressed={active}
                  className={
                    active
                      ? 'px-3 py-1.5 rounded-full text-xs font-semibold bg-accent text-canvas border border-accent'
                      : 'px-3 py-1.5 rounded-full text-xs font-semibold bg-transparent text-ink-muted border border-surface-border'
                  }
                >
                  {ex.name}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
