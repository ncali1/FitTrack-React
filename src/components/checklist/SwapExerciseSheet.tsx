import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { Exercise } from '@/types'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useExercisesStore } from '@/stores/exercises'
import { WORKOUT_LIBRARY } from '@/data/workoutLibrary'
import { findSwapCandidates } from '@/utils/exerciseSwap'
import type { SwapCandidate } from '@/utils/exerciseSwap'
import { ensureExerciseFromLibrary } from '@/utils/libraryExercise'
import { muscleGroupStyle } from '@/utils/muscleGroupStyles'
import { MuscleBodyDiagram } from '@/components/library/MuscleBodyDiagram'

/** Enough choice to find something free on the gym floor without a long scroll mid-set. */
const MAX_CANDIDATES = 8

/**
 * Bottom sheet offering stand-ins for the exercise you're on — same muscles, different
 * equipment — each with the library's animated body preview so you can tell at a glance
 * what the movement is. Picking a library exercise you've never done creates it (from
 * the catalog's targets) before handing it back, exactly like adding from the Library.
 */
export function SwapExerciseSheet({
  exercise,
  excludeNames,
  onPick,
  onCancel,
}: {
  exercise: Exercise
  /** Exercises already in the session, which shouldn't be offered again. */
  excludeNames: string[]
  onPick: (replacement: Exercise) => void | Promise<void>
  onCancel: () => void
}) {
  useBodyScrollLock()
  const exercises = useExercisesStore((s) => s.exercises)
  const [pickingName, setPickingName] = useState<string | null>(null)

  const candidates = findSwapCandidates(exercise, exercises, WORKOUT_LIBRARY, excludeNames).slice(0, MAX_CANDIDATES)

  const handlePick = async (candidate: SwapCandidate) => {
    setPickingName(candidate.name)
    try {
      const replacement = candidate.exercise ?? (await ensureExerciseFromLibrary(candidate.libraryWorkout!))
      await onPick(replacement)
    } catch (err) {
      console.error('Failed to swap exercise:', err)
      toast.error('Couldn’t swap that exercise. Please try again.')
      setPickingName(null)
    }
  }

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="modal-panel" role="dialog" aria-label={`Swap ${exercise.name}`}>
        <div className="p-6">
          <div className="section-header mb-1">
            <h2 className="text-ink">Swap exercise</h2>
            <button onClick={onCancel} className="btn-icon" aria-label="Close">
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <p className="text-sm text-ink-muted mb-4">Alternatives to {exercise.name} that work the same muscles.</p>

          {candidates.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No alternatives found — give {exercise.name} some muscle groups in Profile to get suggestions.
            </p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {candidates.map((candidate) => (
                <li key={candidate.name} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => handlePick(candidate)}
                    disabled={pickingName !== null}
                    aria-label={`Swap to ${candidate.name}`}
                    className="w-full flex items-center gap-3 text-left rounded-xl p-1 -m-1 hover:bg-surface-hover transition-colors disabled:opacity-40"
                  >
                    <div className="flex-none scale-75 -mx-3 -my-4 origin-center" aria-hidden="true">
                      <MuscleBodyDiagram
                        targetMuscleGroups={candidate.targetMuscleGroups}
                        pattern={candidate.movementPattern}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink truncate">
                        {candidate.name}
                        {candidate.exercise && <span className="badge-muted ml-2 align-middle">Yours</span>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {candidate.targetMuscleGroups.map((group) => (
                          <span key={group} className={`badge ${muscleGroupStyle(group).badge}`}>
                            {group}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
