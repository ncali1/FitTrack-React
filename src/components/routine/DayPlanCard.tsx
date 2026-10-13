import { X, Plus } from 'lucide-react'
import type { Exercise, WorkoutTemplate } from '@/types'

const toggleClass = (active: boolean) =>
  active
    ? 'px-3 py-1.5 rounded-full text-xs font-semibold bg-accent text-canvas border border-accent'
    : 'px-3 py-1.5 rounded-full text-xs font-semibold bg-transparent text-ink-muted border border-surface-border'

/**
 * One day's card in the plan builder: chips for the routines and individual exercises
 * assigned to it (each removable), and expandable toggle-grids of every routine and of
 * the whole exercise library to add more.
 */
export function DayPlanCard({
  label,
  assignedTemplates,
  assignedExercises,
  allTemplates,
  allExercises,
  expanded,
  onToggleExpand,
  onAddTemplate,
  onRemoveTemplate,
  onAdd,
  onRemove,
}: {
  label: string
  assignedTemplates: WorkoutTemplate[]
  /** Exercises assigned to this day individually, not counting those inside its routines. */
  assignedExercises: Exercise[]
  allTemplates: WorkoutTemplate[]
  allExercises: Exercise[]
  expanded: boolean
  onToggleExpand: () => void
  onAddTemplate: (templateId: string) => void
  onRemoveTemplate: (templateId: string) => void
  onAdd: (exerciseId: string) => void
  onRemove: (exerciseId: string) => void
}) {
  const assignedIds = new Set(assignedExercises.map((ex) => ex.id))
  const assignedTemplateIds = new Set(assignedTemplates.map((t) => t.id))
  const isRestDay = assignedExercises.length === 0 && assignedTemplates.length === 0

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
        {assignedTemplates.map((template) => (
          <span key={template.id} className="badge-accent !gap-1.5">
            {template.name} · {template.exerciseIds.length}
            <button onClick={() => onRemoveTemplate(template.id)} aria-label={`Remove routine ${template.name}`}>
              <X size={10} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        {assignedExercises.map((ex) => (
          <span key={ex.id} className="badge-muted !gap-1.5">
            {ex.name}
            <button onClick={() => onRemove(ex.id)} aria-label={`Remove ${ex.name}`}>
              <X size={10} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        {isRestDay && <span className="text-xs text-ink-faint">Rest day</span>}
      </div>

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-surface-border">
          <div>
            <span className="field-label">Routines</span>
            <div className="flex flex-wrap gap-1.5">
              {allTemplates.length === 0 ? (
                <span className="text-xs text-ink-faint">No routines yet — create one in Profile.</span>
              ) : (
                allTemplates.map((template) => {
                  const active = assignedTemplateIds.has(template.id)
                  return (
                    <button
                      key={template.id}
                      onClick={() => (active ? onRemoveTemplate(template.id) : onAddTemplate(template.id))}
                      aria-pressed={active}
                      className={toggleClass(active)}
                    >
                      {template.name}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div>
            <span className="field-label">Single exercises</span>
            <div className="flex flex-wrap gap-1.5">
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
                      className={toggleClass(active)}
                    >
                      {ex.name}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
