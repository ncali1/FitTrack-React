import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { useWorkoutTemplatesStore } from '@/stores/workoutTemplates'
import { useExercisesStore } from '@/stores/exercises'
import { WORKOUT_LIBRARY, type LibraryWorkout } from '@/data/workoutLibrary'
import { ensureExerciseFromLibrary, findExerciseForLibraryWorkout } from '@/utils/libraryExercise'
import type { Exercise } from '@/types'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

/**
 * Full-screen editor for one routine (a `WorkoutTemplate`): rename it, reorder or remove
 * its exercises, and add more — either from the user's own exercises or straight from
 * the built-in workout library. Every change saves immediately, and shows up on each day
 * the routine is assigned to.
 */
export function RoutineEditor({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  useBodyScrollLock()
  const template = useWorkoutTemplatesStore((s) => s.templates.find((t) => t.id === templateId))
  const renameTemplate = useWorkoutTemplatesStore((s) => s.renameTemplate)
  const setTemplateExercises = useWorkoutTemplatesStore((s) => s.setTemplateExercises)
  const exercises = useExercisesStore((s) => s.exercises)

  const [nameInput, setNameInput] = useState(template?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [librarySearch, setLibrarySearch] = useState('')

  if (!template) return null

  const included = template.exerciseIds
    .map((id) => exercises.find((e) => e.id === id))
    .filter((ex): ex is Exercise => ex !== undefined)
  const available = exercises.filter((ex) => !template.exerciseIds.includes(ex.id))
  // Library entries the user doesn't have yet — ones they do have are already listed above.
  const libraryQuery = librarySearch.trim().toLowerCase()
  const libraryMatches = WORKOUT_LIBRARY.filter(
    (workout) =>
      !findExerciseForLibraryWorkout(workout, exercises) &&
      (libraryQuery === '' ||
        workout.name.toLowerCase().includes(libraryQuery) ||
        workout.targetMuscleGroups.some((group) => group.toLowerCase().includes(libraryQuery)))
  )

  const save = async (exerciseIds: string[]) => {
    try {
      await setTemplateExercises(template.id, exerciseIds)
    } catch (err) {
      console.error('Failed to update routine:', err)
      setError('Failed to update routine. Please try again.')
    }
  }

  const addFromLibrary = async (workout: LibraryWorkout) => {
    try {
      const exercise = await ensureExerciseFromLibrary(workout)
      await setTemplateExercises(template.id, [...template.exerciseIds, exercise.id])
    } catch (err) {
      console.error('Failed to add from library:', err)
      setError('Failed to add that exercise. Please try again.')
    }
  }

  const move = (index: number, delta: -1 | 1) => {
    const ids = included.map((ex) => ex.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
    save(ids)
  }

  const commitName = async () => {
    const name = nameInput.trim()
    if (!name) {
      setNameInput(template.name)
      return
    }
    if (name === template.name) return
    try {
      await renameTemplate(template.id, name)
    } catch (err) {
      console.error('Failed to rename routine:', err)
      setError('Failed to rename routine. Please try again.')
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[55] bg-canvas flex flex-col">
      <div className="flex-none pwa-safe-top flex items-center justify-between px-5 py-4 border-b border-surface-border">
        <h3 className="text-ink">Edit routine</h3>
        <button onClick={onClose} className="btn-icon" aria-label="Close">
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5 pwa-safe-bottom">
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

        <div>
          <label className="field-label" htmlFor="routine-name">
            Name
          </label>
          <input
            id="routine-name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            type="text"
            className="field-input"
          />
        </div>

        <div>
          <span className="field-label">Exercises ({included.length})</span>
          {included.length === 0 ? (
            <p className="text-sm text-ink-faint">Nothing here yet — add exercises below.</p>
          ) : (
            <ol className="card divide-y divide-surface-border">
              {included.map((ex, index) => (
                <li key={ex.id} className="flex items-center gap-2 px-3.5 py-2.5">
                  <span className="w-5 text-xs text-ink-faint flex-none">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink truncate">{ex.name}</div>
                    <div className="text-[11px] text-ink-muted">
                      {ex.targetSets} × {ex.targetReps}
                    </div>
                  </div>
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="btn-icon !w-8 !h-8 disabled:opacity-30"
                    aria-label={`Move ${ex.name} up`}
                  >
                    <ChevronUp size={16} strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === included.length - 1}
                    className="btn-icon !w-8 !h-8 disabled:opacity-30"
                    aria-label={`Move ${ex.name} down`}
                  >
                    <ChevronDown size={16} strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => save(template.exerciseIds.filter((id) => id !== ex.id))}
                    className="btn-icon !w-8 !h-8"
                    aria-label={`Remove ${ex.name}`}
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <span className="field-label">Add your exercises</span>
          <div className="flex flex-wrap gap-1.5">
            {exercises.length === 0 ? (
              <span className="text-xs text-ink-faint">You haven’t created any yet — pick from the library below.</span>
            ) : available.length === 0 ? (
              <span className="text-xs text-ink-faint">Every exercise you have is already in this routine.</span>
            ) : (
              available.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => save([...template.exerciseIds, ex.id])}
                  aria-label={`Add ${ex.name}`}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-transparent text-ink-muted border border-surface-border"
                >
                  + {ex.name}
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <span className="field-label">Add from library</span>
          <div className="relative mb-2.5">
            <Search
              size={16}
              strokeWidth={2}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
            />
            <input
              type="text"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              placeholder="Search by name or muscle"
              aria-label="Search workout library"
              className="field-input !pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {libraryMatches.length === 0 ? (
              <span className="text-xs text-ink-faint">
                {libraryQuery === '' ? 'You already have every library exercise.' : 'No library exercises match.'}
              </span>
            ) : (
              libraryMatches.map((workout) => (
                <button
                  key={workout.id}
                  onClick={() => addFromLibrary(workout)}
                  aria-label={`Add ${workout.name} from library`}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-transparent text-ink-muted border border-surface-border"
                >
                  + {workout.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
