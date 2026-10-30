import { useState } from 'react'
import { Pencil, Copy, X, CalendarDays } from 'lucide-react'
import { useRoutineStore } from '@/stores/routine'
import { RoutineBuilder } from '@/components/routine/RoutineBuilder'
import { InlineNameForm } from './InlineNameForm'
import type { Routine } from '@/types'

/**
 * The weekly plan: which program (a saved week, stored as a `Routine`) is active, with
 * create / rename / duplicate / delete, and the entry point to the plan builder that
 * assigns routines and exercises to each day of the active one.
 */
export function ProgramsCard({ onError }: { onError: (message: string) => void }) {
  const programs = useRoutineStore((s) => s.routines)
  const createRoutine = useRoutineStore((s) => s.createRoutine)
  const renameRoutine = useRoutineStore((s) => s.renameRoutine)
  const duplicateRoutine = useRoutineStore((s) => s.duplicateRoutine)
  const deleteRoutine = useRoutineStore((s) => s.deleteRoutine)
  const setActiveRoutine = useRoutineStore((s) => s.setActiveRoutine)

  const [showPlanBuilder, setShowPlanBuilder] = useState(false)
  /** `'new'` while creating, a program while renaming it, `null` when the form is closed. */
  const [naming, setNaming] = useState<Routine | 'new' | null>(null)

  const handleSaveName = async (name: string) => {
    try {
      if (naming === 'new') {
        const created = await createRoutine(name)
        await setActiveRoutine(created.id)
      } else if (naming) {
        await renameRoutine(naming.id, name)
      }
      setNaming(null)
    } catch (err) {
      console.error('Failed to save program name:', err)
      onError('Failed to save program. Please try again.')
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateRoutine(id)
    } catch (err) {
      console.error('Failed to duplicate program:', err)
      onError('Failed to duplicate program. Please try again.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this program? This cannot be undone.')) return
    try {
      await deleteRoutine(id)
    } catch (err) {
      console.error('Failed to delete program:', err)
      onError('Failed to delete program. Please try again.')
    }
  }

  return (
    <div className="card-pad space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-ink text-sm">Weekly plan</h3>
        <button onClick={() => setNaming('new')} className="btn-ghost !px-2.5 !py-1 text-xs">
          + New program
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {programs.map((program) => (
          <div key={program.id} className="flex items-center gap-1">
            <button
              onClick={() => setActiveRoutine(program.id)}
              aria-pressed={program.isActive}
              className={
                program.isActive
                  ? 'px-3 py-1.5 rounded-full text-xs font-semibold bg-accent text-canvas border border-accent'
                  : 'px-3 py-1.5 rounded-full text-xs font-semibold bg-transparent text-ink-muted border border-surface-border'
              }
            >
              {program.name}
            </button>
            {program.isActive && (
              <>
                <button onClick={() => setNaming(program)} className="btn-icon !w-7 !h-7" aria-label="Rename program">
                  <Pencil size={13} strokeWidth={2} />
                </button>
                <button
                  onClick={() => handleDuplicate(program.id)}
                  className="btn-icon !w-7 !h-7"
                  aria-label="Duplicate program"
                >
                  <Copy size={13} strokeWidth={2} />
                </button>
              </>
            )}
            {programs.length > 1 && (
              <button
                onClick={() => handleDelete(program.id)}
                className="btn-icon !w-7 !h-7"
                aria-label="Delete program"
              >
                <X size={13} strokeWidth={2} />
              </button>
            )}
          </div>
        ))}
      </div>

      {naming && (
        <InlineNameForm
          key={naming === 'new' ? 'new' : naming.id}
          label="Program name"
          initialValue={naming === 'new' ? '' : naming.name}
          onSave={handleSaveName}
          onCancel={() => setNaming(null)}
        />
      )}

      <button className="btn-secondary w-full" onClick={() => setShowPlanBuilder(true)}>
        <CalendarDays size={16} strokeWidth={2} />
        Manage weekly plan
      </button>

      {showPlanBuilder && <RoutineBuilder onClose={() => setShowPlanBuilder(false)} />}
    </div>
  )
}
