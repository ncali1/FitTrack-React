import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { useExercisesStore } from '@/stores/exercises'
import type { Exercise } from '@/types'
import { muscleGroupStyle } from '@/utils/muscleGroupStyles'
import { ExerciseForm } from './ExerciseForm'

/** How long a deleted exercise stays undo-able before the delete actually commits to storage. */
const UNDO_WINDOW_MS = 5000

function ExerciseCard({
  exercise,
  onEdit,
  onDelete,
}: {
  exercise: Exercise
  onEdit: (exercise: Exercise) => void
  onDelete: (exercise: Exercise) => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-base font-semibold text-ink truncate">{exercise.name}</h3>
      </div>
      <div className="flex gap-3 text-xs text-ink-muted mb-3 flex-wrap">
        <span className="badge-muted">Sets: {exercise.targetSets}</span>
        <span className="badge-muted">Reps: {exercise.targetReps}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {exercise.targetMuscleGroups.map((group) => (
          <span key={group} className={`badge ${muscleGroupStyle(group).badge}`}>
            {group}
          </span>
        ))}
      </div>
      <div className="flex gap-2 mt-auto">
        <button className="btn-secondary flex-1 !px-3 !py-1.5 text-xs" onClick={() => onEdit(exercise)}>
          Edit
        </button>
        <button className="btn-danger flex-1 !px-3 !py-1.5 text-xs" onClick={() => onDelete(exercise)}>
          Delete
        </button>
      </div>
    </div>
  )
}

/**
 * Displays the full list of exercises and manages create / edit / delete interactions,
 * plus search, muscle-group filtering, and undo-able deletes.
 *
 * Deleting is optimistic: the exercise is hidden from the list immediately and a toast
 * with an Undo action appears. The store's `deleteExercise` (which commits to
 * IndexedDB/cloud) is only actually called once UNDO_WINDOW_MS elapses with no Undo
 * click — clicking Undo just clears the pending timer and un-hides the exercise, so
 * nothing was ever removed from storage in that case.
 */
export function ExerciseList() {
  const exercises = useExercisesStore((s) => s.exercises)
  const deleteExercise = useExercisesStore((s) => s.deleteExercise)

  const [showForm, setShowForm] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('All')
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set())

  const pendingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Clears any still-pending delete timers on unmount so a commit never fires against a
  // store no one's watching anymore.
  useEffect(() => {
    const timers = pendingTimers.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const visibleExercises = useMemo(
    () => exercises.filter((ex) => !pendingDeleteIds.has(ex.id)),
    [exercises, pendingDeleteIds]
  )

  const muscleGroups = useMemo(() => {
    const groups = new Set<string>()
    visibleExercises.forEach((ex) => ex.targetMuscleGroups.forEach((group) => groups.add(group)))
    return Array.from(groups).sort()
  }, [visibleExercises])

  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return visibleExercises.filter((ex) => {
      const matchesSearch = query === '' || ex.name.toLowerCase().includes(query)
      const matchesGroup = selectedGroup === 'All' || ex.targetMuscleGroups.includes(selectedGroup)
      return matchesSearch && matchesGroup
    })
  }, [visibleExercises, searchQuery, selectedGroup])

  const editExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise)
    setShowForm(true)
  }

  const commitDelete = (id: string) => {
    pendingTimers.current.delete(id)
    deleteExercise(id).catch((err) => console.error('Failed to delete exercise:', err))
  }

  const cancelDelete = (id: string) => {
    const timer = pendingTimers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      pendingTimers.current.delete(id)
    }
    setPendingDeleteIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleDelete = (exercise: Exercise) => {
    setPendingDeleteIds((prev) => new Set(prev).add(exercise.id))
    pendingTimers.current.set(
      exercise.id,
      setTimeout(() => commitDelete(exercise.id), UNDO_WINDOW_MS)
    )

    toast(`${exercise.name} deleted`, {
      duration: UNDO_WINDOW_MS,
      action: {
        label: 'Undo',
        onClick: () => cancelDelete(exercise.id),
      },
    })
  }

  const closeForm = () => {
    setShowForm(false)
    setSelectedExercise(null)
  }

  return (
    <div className="space-y-5">
      <div className="section-header">
        <div>
          <h2 className="text-ink">Exercises</h2>
          <p className="text-ink-muted text-sm mt-0.5">{exercises.length} in your library</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} strokeWidth={2.5} />
          Add Exercise
        </button>
      </div>

      {exercises.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exercises..."
              aria-label="Search exercises"
              className="field-input !pl-10 !pr-9"
            />
            {searchQuery !== '' && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
              >
                <X size={16} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedGroup('All')}
              aria-pressed={selectedGroup === 'All'}
              className={selectedGroup === 'All' ? 'badge-accent' : 'badge-muted'}
            >
              All
            </button>
            {muscleGroups.map((group) => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                aria-pressed={selectedGroup === group}
                className={selectedGroup === group ? `badge ${muscleGroupStyle(group).badge}` : 'badge-muted'}
              >
                {group}
              </button>
            ))}
          </div>
        </div>
      )}

      {exercises.length === 0 ? (
        <div className="card-pad text-center py-14">
          <div className="empty-blob animate-float">🏋️</div>
          <p className="text-ink font-semibold">No exercises yet</p>
          <p className="text-ink-muted text-sm mt-1">Create one to start building your routine.</p>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="card-pad text-center py-14">
          <div className="empty-blob">🔍</div>
          <p className="text-ink font-semibold">No matches</p>
          <p className="text-ink-muted text-sm mt-1">Try a different search term or muscle group.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filteredExercises.map((exercise) => (
            <div key={exercise.id} className="card-pad card-hover animate-pop-in">
              <ExerciseCard exercise={exercise} onEdit={editExercise} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ExerciseForm
          key={selectedExercise?.id ?? 'new'}
          exercise={selectedExercise}
          onSubmit={closeForm}
          onCancel={closeForm}
        />
      )}
    </div>
  )
}
