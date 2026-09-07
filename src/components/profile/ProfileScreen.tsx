import { useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, X, CalendarDays, Dumbbell } from 'lucide-react'
import { useRoutineStore, selectActiveRoutine } from '@/stores/routine'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { RoutineBuilder } from '@/components/routine/RoutineBuilder'
import { ExerciseManager } from '@/components/exercises/ExerciseManager'
import type { Routine } from '@/types'

const REST_PRESETS = [30, 60, 90, 120, 180]

/** Full-screen sheet wrapping ExerciseManager, portaled for the same reason every other
 *  overlay in this app is — an ancestor's lingering transform breaks `position: fixed`. */
function ExerciseManagerSheet({ onClose }: { onClose: () => void }) {
  return createPortal(
    // z-55, deliberately below .modal-overlay's z-60 — ExerciseForm opens as a modal
    // from inside this sheet, and needs to stack above it rather than behind it.
    <div className="fixed inset-0 z-[55] bg-canvas flex flex-col">
      <div className="flex-none pwa-safe-top flex items-center justify-between px-5 py-4 border-b border-surface-border">
        <h3 className="text-ink">Your exercises</h3>
        <button onClick={onClose} className="btn-icon" aria-label="Close">
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 pwa-safe-bottom">
        <ExerciseManager />
      </div>
    </div>,
    document.body
  )
}

export function ProfileScreen() {
  const routines = useRoutineStore((s) => s.routines)
  const activeRoutine = selectActiveRoutine(routines)
  const createRoutine = useRoutineStore((s) => s.createRoutine)
  const renameRoutine = useRoutineStore((s) => s.renameRoutine)
  const deleteRoutine = useRoutineStore((s) => s.deleteRoutine)
  const setActiveRoutine = useRoutineStore((s) => s.setActiveRoutine)

  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const toggleWeightUnit = useSettingsStore((s) => s.toggleWeightUnit)
  const restDuration = useSettingsStore((s) => s.restDuration)
  const setRestDuration = useSettingsStore((s) => s.setRestDuration)
  const remindersEnabled = useSettingsStore((s) => s.remindersEnabled)
  const setRemindersEnabled = useSettingsStore((s) => s.setRemindersEnabled)

  const cloudEnabled = useAuthStore((s) => s.cloudEnabled)
  const isAuthenticated = useAuthStore((s) => s.user !== null)
  const userEmail = useAuthStore((s) => s.user?.email ?? null)
  const signOut = useAuthStore((s) => s.signOut)

  const [showPlanBuilder, setShowPlanBuilder] = useState(false)
  const [showExerciseManager, setShowExerciseManager] = useState(false)
  const [showNameForm, setShowNameForm] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  const handleDeleteRoutine = async (id: string) => {
    if (!confirm('Delete this routine? This cannot be undone.')) return
    try {
      await deleteRoutine(id)
    } catch (err) {
      console.error('Failed to delete routine:', err)
      setError('Failed to delete routine. Please try again.')
    }
  }

  const initial = userEmail ? userEmail[0]!.toUpperCase() : 'Y'
  const displayName = userEmail ?? 'You'

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

      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-accent-800 text-accent-100 flex items-center justify-center text-xl font-semibold flex-none">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold text-ink truncate">{displayName}</div>
          <div className="text-xs text-ink-muted mt-0.5">{activeRoutine?.name ?? 'No active routine'}</div>
        </div>
      </div>

      <button className="btn-secondary w-full" onClick={() => setShowPlanBuilder(true)}>
        <CalendarDays size={16} strokeWidth={2} />
        Manage weekly plan
      </button>

      <div className="card-pad space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-ink text-sm">Your routines</h3>
          <button onClick={openCreateForm} className="btn-ghost !px-2.5 !py-1 text-xs">
            + New
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {routines.map((r) => (
            <div key={r.id} className="flex items-center gap-1">
              <button
                onClick={() => setActiveRoutine(r.id)}
                className={
                  r.isActive
                    ? 'px-3 py-1.5 rounded-full text-xs font-semibold bg-accent text-canvas border border-accent'
                    : 'px-3 py-1.5 rounded-full text-xs font-semibold bg-transparent text-ink-muted border border-surface-border'
                }
              >
                {r.name}
              </button>
              {r.isActive && (
                <button onClick={() => openRenameForm(r)} className="btn-icon !w-7 !h-7" aria-label="Rename routine">
                  <Pencil size={13} strokeWidth={2} />
                </button>
              )}
              {routines.length > 1 && (
                <button
                  onClick={() => handleDeleteRoutine(r.id)}
                  className="btn-icon !w-7 !h-7"
                  aria-label="Delete routine"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
        </div>

        {showNameForm && (
          <form onSubmit={submitName} className="flex gap-2">
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
            <button type="button" onClick={() => setShowNameForm(false)} className="btn-ghost !px-3 !py-1.5 text-xs">
              Cancel
            </button>
          </form>
        )}
      </div>

      <button className="btn-secondary w-full" onClick={() => setShowExerciseManager(true)}>
        <Dumbbell size={16} strokeWidth={2} />
        Manage exercises
      </button>

      <div className="card p-3.5 divide-y divide-surface-border">
        <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
          <span className="text-sm text-ink">Units</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => weightUnit !== 'kg' && toggleWeightUnit()}
              className={
                weightUnit === 'kg'
                  ? 'px-3 py-1 rounded-full text-xs font-semibold bg-accent text-canvas border border-accent'
                  : 'px-3 py-1 rounded-full text-xs font-semibold bg-transparent text-ink-muted border border-surface-border'
              }
            >
              kg
            </button>
            <button
              onClick={() => weightUnit !== 'lb' && toggleWeightUnit()}
              className={
                weightUnit === 'lb'
                  ? 'px-3 py-1 rounded-full text-xs font-semibold bg-accent text-canvas border border-accent'
                  : 'px-3 py-1 rounded-full text-xs font-semibold bg-transparent text-ink-muted border border-surface-border'
              }
            >
              lb
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
          <span className="text-sm text-ink">Rest timer</span>
          <div className="flex flex-wrap justify-end gap-1.5">
            {REST_PRESETS.map((seconds) => (
              <button
                key={seconds}
                onClick={() => setRestDuration(seconds)}
                className={
                  restDuration === seconds
                    ? 'px-2.5 py-1 rounded-full text-xs font-semibold bg-accent text-canvas border border-accent'
                    : 'px-2.5 py-1 rounded-full text-xs font-semibold bg-transparent text-ink-muted border border-surface-border'
                }
              >
                {seconds}s
              </button>
            ))}
          </div>
        </div>

        {cloudEnabled && (
          <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
            <span className="text-sm text-ink">Cloud sync</span>
            {isAuthenticated ? (
              <span className="badge-lime">Synced</span>
            ) : (
              <span className="text-xs text-ink-faint">Not signed in</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
          <span className="text-sm text-ink">Notifications</span>
          <button
            role="switch"
            aria-checked={remindersEnabled === true}
            aria-label="Notifications"
            onClick={() => setRemindersEnabled(!remindersEnabled)}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors ${remindersEnabled ? 'bg-accent' : 'bg-canvas-800'}`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${remindersEnabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>

      {cloudEnabled && isAuthenticated && (
        <button className="btn-ghost w-full justify-center" onClick={() => signOut()}>
          Sign out
        </button>
      )}

      {showPlanBuilder && <RoutineBuilder onClose={() => setShowPlanBuilder(false)} />}
      {showExerciseManager && <ExerciseManagerSheet onClose={() => setShowExerciseManager(false)} />}
    </div>
  )
}
