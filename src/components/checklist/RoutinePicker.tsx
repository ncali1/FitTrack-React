import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { WorkoutTemplate } from '@/types'

/**
 * Bottom sheet for choosing a routine to do on the selected day, regardless of what the
 * weekly plan schedules. Each routine can replace the day's plan or, when the day already
 * has exercises (`canAdd`), be added on top of it.
 */
export function RoutinePicker({
  templates,
  canAdd,
  onPick,
  onCancel,
}: {
  templates: WorkoutTemplate[]
  canAdd: boolean
  onPick: (templateId: string, mode: 'replace' | 'add') => void
  onCancel: () => void
}) {
  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="modal-panel" role="dialog" aria-label="Choose a routine">
        <div className="p-6">
          <div className="section-header mb-4">
            <h2 className="text-ink">Choose a routine</h2>
            <button onClick={onCancel} className="btn-icon" aria-label="Close">
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-ink-muted">You don’t have any routines yet — create one in Profile.</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {templates.map((template) => {
                const count = template.exerciseIds.length
                return (
                  <li key={template.id} className="flex items-center gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink truncate">{template.name}</div>
                      <div className="text-[11px] text-ink-muted">
                        {count} {count === 1 ? 'exercise' : 'exercises'}
                      </div>
                    </div>
                    {canAdd && (
                      <button
                        onClick={() => onPick(template.id, 'add')}
                        disabled={count === 0}
                        className="btn-secondary !px-3 !py-1.5 text-xs"
                        aria-label={`Add ${template.name} to this day`}
                      >
                        Add
                      </button>
                    )}
                    <button
                      onClick={() => onPick(template.id, 'replace')}
                      disabled={count === 0}
                      className="btn-primary !px-3 !py-1.5 text-xs"
                      aria-label={canAdd ? `Replace this day with ${template.name}` : `Do ${template.name}`}
                    >
                      {canAdd ? 'Replace' : 'Do this'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
