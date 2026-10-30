import { useState } from 'react'
import { Pencil, Copy, X } from 'lucide-react'
import { useWorkoutTemplatesStore } from '@/stores/workoutTemplates'
import { useRoutineStore, selectActiveRoutine } from '@/stores/routine'
import { RoutineEditor } from '@/components/routine/RoutineEditor'
import { InlineNameForm } from './InlineNameForm'
import type { WorkoutTemplate } from '@/types'

const DAY_ABBREVIATIONS: [day: string, label: string][] = [
  ['monday', 'Mon'],
  ['tuesday', 'Tue'],
  ['wednesday', 'Wed'],
  ['thursday', 'Thu'],
  ['friday', 'Fri'],
  ['saturday', 'Sat'],
  ['sunday', 'Sun'],
]

/**
 * The user's routines — reusable named exercise lists (`WorkoutTemplate`s) — with create,
 * edit, duplicate, and delete. Each row shows how many exercises it holds and which days
 * of the active program it is scheduled on; scheduling itself happens in the weekly plan.
 */
export function RoutinesCard({ onError }: { onError: (message: string) => void }) {
  const templates = useWorkoutTemplatesStore((s) => s.templates)
  const createTemplate = useWorkoutTemplatesStore((s) => s.createTemplate)
  const duplicateTemplate = useWorkoutTemplatesStore((s) => s.duplicateTemplate)
  const deleteTemplate = useWorkoutTemplatesStore((s) => s.deleteTemplate)
  const activeProgram = selectActiveRoutine(useRoutineStore((s) => s.routines))

  const [showNameForm, setShowNameForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const scheduledDays = (template: WorkoutTemplate) =>
    DAY_ABBREVIATIONS.filter(([day]) => activeProgram?.weeklyTemplates?.[day]?.includes(template.id)).map(
      ([, label]) => label
    )

  const handleCreate = async (name: string) => {
    try {
      const created = await createTemplate(name)
      setShowNameForm(false)
      setEditingId(created.id)
    } catch (err) {
      console.error('Failed to create routine:', err)
      onError('Failed to create routine. Please try again.')
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTemplate(id)
    } catch (err) {
      console.error('Failed to duplicate routine:', err)
      onError('Failed to duplicate routine. Please try again.')
    }
  }

  const handleDelete = async (template: WorkoutTemplate) => {
    const days = scheduledDays(template)
    const warning = days.length > 0 ? ` It will also be removed from ${days.join(', ')}.` : ''
    if (!confirm(`Delete "${template.name}"?${warning} This cannot be undone.`)) return
    try {
      await deleteTemplate(template.id)
    } catch (err) {
      console.error('Failed to delete routine:', err)
      onError('Failed to delete routine. Please try again.')
    }
  }

  return (
    <div className="card-pad space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-ink text-sm">Routines</h3>
        <button onClick={() => setShowNameForm(true)} className="btn-ghost !px-2.5 !py-1 text-xs">
          + New routine
        </button>
      </div>

      {templates.length === 0 && !showNameForm && (
        <p className="text-xs text-ink-faint">
          A routine is a set of exercises you do together, like “Push Day”. Create one, then assign it to any day in
          your weekly plan or start it from Train.
        </p>
      )}

      {templates.length > 0 && (
        <ul className="divide-y divide-surface-border">
          {templates.map((template) => {
            const days = scheduledDays(template)
            const count = template.exerciseIds.length
            return (
              <li key={template.id} className="flex items-center gap-1 py-2 first:pt-0 last:pb-0">
                <button onClick={() => setEditingId(template.id)} className="flex-1 min-w-0 text-left">
                  <div className="text-sm text-ink truncate">{template.name}</div>
                  <div className="text-[11px] text-ink-muted">
                    {count} {count === 1 ? 'exercise' : 'exercises'}
                    {days.length > 0 && ` · ${days.join(', ')}`}
                  </div>
                </button>
                <button
                  onClick={() => setEditingId(template.id)}
                  className="btn-icon !w-8 !h-8"
                  aria-label={`Edit ${template.name}`}
                >
                  <Pencil size={14} strokeWidth={2} />
                </button>
                <button
                  onClick={() => handleDuplicate(template.id)}
                  className="btn-icon !w-8 !h-8"
                  aria-label={`Duplicate ${template.name}`}
                >
                  <Copy size={14} strokeWidth={2} />
                </button>
                <button
                  onClick={() => handleDelete(template)}
                  className="btn-icon !w-8 !h-8"
                  aria-label={`Delete ${template.name}`}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {showNameForm && (
        <InlineNameForm label="Routine name" onSave={handleCreate} onCancel={() => setShowNameForm(false)} />
      )}

      {editingId && <RoutineEditor templateId={editingId} onClose={() => setEditingId(null)} />}
    </div>
  )
}
