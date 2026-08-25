import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Pencil, X } from 'lucide-react'
import { useRoutineStore, selectRoutineForDay } from '@/stores/routine'
import type { Routine } from '@/types'
import { WeeklyGrid } from './WeeklyGrid'
import { ExerciseSelector } from './ExerciseSelector'

/**
 * Allows the user to build a weekly workout routine by assigning exercises to specific
 * days, and to manage multiple saved routines/programs (e.g. push/pull/legs, 5x5) —
 * switching, creating, renaming, and deleting them. Composes WeeklyGrid (for day
 * selection) with ExerciseSelector (for add/remove operations); all of that operates on
 * whichever routine is currently active, transparently, via the routine store.
 */
export function RoutineBuilder() {
  const routines = useRoutineStore((s) => s.routines)
  const routineLoading = useRoutineStore((s) => s.loading)
  const routineError = useRoutineStore((s) => s.error)
  const assignExercise = useRoutineStore((s) => s.assignExercise)
  const removeExercise = useRoutineStore((s) => s.removeExercise)
  const saveRoutineAction = useRoutineStore((s) => s.saveRoutine)
  const loadRoutines = useRoutineStore((s) => s.loadRoutines)
  const createRoutine = useRoutineStore((s) => s.createRoutine)
  const renameRoutine = useRoutineStore((s) => s.renameRoutine)
  const deleteRoutine = useRoutineStore((s) => s.deleteRoutine)
  const setActiveRoutine = useRoutineStore((s) => s.setActiveRoutine)

  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState('monday')

  const [showNameForm, setShowNameForm] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')

  useEffect(() => {
    loadRoutines().catch((err) => {
      console.error('Failed to load routines:', err)
      setError('Failed to load routines. Please refresh the page.')
    })
  }, [loadRoutines])

  const handleAddExercise = async (exerciseId: string) => {
    try {
      await assignExercise(selectedDay, exerciseId)
    } catch (err) {
      console.error('Failed to add exercise:', err)
      setError('Failed to add exercise to routine. Please try again.')
    }
  }

  const handleRemoveExercise = async (exerciseId: string) => {
    try {
      await removeExercise(selectedDay, exerciseId)
    } catch (err) {
      console.error('Failed to remove exercise:', err)
      setError('Failed to remove exercise from routine. Please try again.')
    }
  }

  const handleSaveRoutine = async () => {
    try {
      await saveRoutineAction()
    } catch (err) {
      console.error('Failed to save routine:', err)
      setError('Failed to save routine. Please try again.')
    }
  }

  const handleResetRoutine = () => {
    loadRoutines()
  }

  const openCreateForm = () => {
    setRenamingId(null)
    setNameInput('')
    setShowNameForm(true)
  }

  const openRenameForm = (r: Routine) => {
    setRenamingId(r.id)
    setNameInput(r.name)
    setShowNameForm(true)
  }

  const cancelNameForm = () => setShowNameForm(false)

  const submitName = async (e: FormEvent) => {
    e.preventDefault()
    const name = nameInput.trim()
    if (!name) return

    try {
      if (renamingId) {
        await renameRoutine(renamingId, name)
      } else {
        const created = await createRoutine(name)
        await setActiveRoutine(created.id)
      }
      setShowNameForm(false)
    } catch (err) {
      console.error('Failed to save routine name:', err)
      setError('Failed to save routine. Please try again.')
    }
  }

  const switchRoutine = async (id: string) => {
    try {
      await setActiveRoutine(id)
    } catch (err) {
      console.error('Failed to switch routine:', err)
      setError('Failed to switch routine. Please try again.')
    }
  }

  const handleDeleteRoutine = async (id: string) => {
    if (!confirm('Delete this routine? This cannot be undone.')) return
    try {
      await deleteRoutine(id)
    } catch (err) {
      console.error('Failed to delete routine:', err)
      setError('Failed to delete routine. Please try again.')
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="alert-error">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 ml-2 text-lg leading-none"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {routineError && (
        <div className="alert-error">
          <p className="text-red-400 text-sm">{routineError}</p>
        </div>
      )}

      {routineLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-surface-border border-t-accent-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="card-pad">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-ink">Routines</h2>
              <button onClick={openCreateForm} className="btn-secondary !px-3 !py-1.5 text-xs">
                + New Routine
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {routines.map((r) => (
                <div key={r.id} className="flex items-center gap-1">
                  <button onClick={() => switchRoutine(r.id)} className={r.isActive ? 'badge-accent' : 'badge-muted'}>
                    {r.name}
                  </button>
                  {r.isActive && (
                    <button onClick={() => openRenameForm(r)} className="btn-icon !w-7 !h-7" aria-label="Rename routine">
                      <Pencil size={14} strokeWidth={2} />
                    </button>
                  )}
                  {routines.length > 1 && (
                    <button
                      onClick={() => handleDeleteRoutine(r.id)}
                      className="btn-icon !w-7 !h-7"
                      aria-label="Delete routine"
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {showNameForm && (
              <form onSubmit={submitName} className="flex gap-2 mt-3">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  type="text"
                  placeholder="Routine name"
                  className="field-input flex-1"
                  aria-label="Routine name"
                />
                <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
                  Save
                </button>
                <button type="button" onClick={cancelNameForm} className="btn-ghost !px-3 !py-1.5 text-xs">
                  Cancel
                </button>
              </form>
            )}
          </div>

          <WeeklyGrid selectedDay={selectedDay} onSelectDay={setSelectedDay} />

          <ExerciseSelector
            day={selectedDay}
            selectedExercises={selectRoutineForDay(routines, selectedDay)}
            onAddExercise={handleAddExercise}
            onRemoveExercise={handleRemoveExercise}
          />

          <div className="flex gap-3">
            <button onClick={handleSaveRoutine} disabled={routineLoading} className="btn-primary">
              {routineLoading ? 'Saving...' : 'Save Routine'}
            </button>
            <button onClick={handleResetRoutine} className="btn-secondary">
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  )
}
