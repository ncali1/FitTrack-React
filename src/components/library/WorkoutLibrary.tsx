import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Dumbbell, ChevronRight, Check, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useExercisesStore } from '@/stores/exercises'
import { useRoutineStore } from '@/stores/routine'
import { muscleGroupStyle } from '@/utils/muscleGroupStyles'
import { getDayOfWeek, getPlannedExerciseIds } from '@/utils/calculations'
import { useActiveProgram } from '@/hooks/useActiveProgram'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { WORKOUT_LIBRARY, type LibraryWorkout } from '@/data/workoutLibrary'
import { useWorkoutTemplatesStore } from '@/stores/workoutTemplates'
import { ensureExerciseFromLibrary, findExerciseForLibraryWorkout } from '@/utils/libraryExercise'
import { ExercisePreview } from './ExercisePreview'
import { InlineNameForm } from '@/components/profile/InlineNameForm'
import { ExerciseForm } from '@/components/exercises/ExerciseForm'
import type { Exercise, WorkoutTemplate } from '@/types'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

/** Broader region groupings for the filter chips — several raw muscle groups collapse
 *  into one chip (e.g. Biceps/Triceps/Forearms -> Arms) to keep the filter row short. */
const FILTER_GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core']

function regionOf(muscleGroup: string): string {
  if (['Triceps', 'Biceps', 'Forearms'].includes(muscleGroup)) return 'Arms'
  if (['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'].includes(muscleGroup)) return 'Legs'
  return muscleGroup
}

/** Order regions appear in the list, matching the filter chips. */
const REGION_ORDER = FILTER_GROUPS.slice(1)

/**
 * One row of the library: a built-in catalog entry (with the user's own copy attached
 * once they've used it), or an exercise the user created themselves.
 */
interface LibraryItem {
  key: string
  name: string
  targetSets: number
  targetReps: number
  targetMuscleGroups: string[]
  description?: string
  /** The built-in entry this row comes from, if any. */
  catalog?: LibraryWorkout
  /** The user's own exercise for this row: their custom one, or their copy of the catalog entry. */
  exercise?: Exercise
}

/** Built-in entries plus the user's custom exercises, as one list ordered by body region. */
function buildLibrary(exercises: Exercise[]): LibraryItem[] {
  const catalogItems: LibraryItem[] = WORKOUT_LIBRARY.map((workout) => {
    const exercise = findExerciseForLibraryWorkout(workout, exercises)
    return {
      key: `catalog:${workout.id}`,
      name: workout.name,
      // Once the user has their own copy, show their targets rather than the defaults.
      targetSets: exercise?.targetSets ?? workout.targetSets,
      targetReps: exercise?.targetReps ?? workout.targetReps,
      targetMuscleGroups: exercise?.targetMuscleGroups ?? workout.targetMuscleGroups,
      description: workout.description,
      catalog: workout,
      exercise,
    }
  })
  const customItems: LibraryItem[] = exercises
    .filter((exercise) => !WORKOUT_LIBRARY.some((w) => w.name.toLowerCase() === exercise.name.toLowerCase()))
    .map((exercise) => ({
      key: `custom:${exercise.id}`,
      name: exercise.name,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
      targetMuscleGroups: exercise.targetMuscleGroups,
      exercise,
    }))

  const regionRank = (item: LibraryItem) => {
    const rank = REGION_ORDER.indexOf(regionOf(item.targetMuscleGroups[0] ?? ''))
    return rank === -1 ? REGION_ORDER.length : rank
  }
  // Array.prototype.sort is stable, so catalog order is kept within each region.
  return [...catalogItems, ...customItems].sort((a, b) => regionRank(a) - regionRank(b))
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * The Library tab: one searchable, filterable list of every exercise — the built-in
 * catalog plus the user's own — each marked with an icon tinted by its main muscle group.
 * "Add exercise" creates a custom one. Tapping a row opens a sheet to add it to today or
 * to a routine (adding a catalog entry also adds it to the user's exercises the first
 * time), and to edit or delete it if it's custom.
 */
export function WorkoutLibrary() {
  const exercises = useExercisesStore((s) => s.exercises)
  const deleteExercise = useExercisesStore((s) => s.deleteExercise)
  const templates = useWorkoutTemplatesStore((s) => s.templates)
  const createTemplate = useWorkoutTemplatesStore((s) => s.createTemplate)
  const setTemplateExercises = useWorkoutTemplatesStore((s) => s.setTemplateExercises)
  const activeRoutine = useActiveProgram()
  const todaySession = useWorkoutSessionsStore((s) => s.sessions.find((session) => session.date === todayString()))
  const setPlannedExercises = useWorkoutSessionsStore((s) => s.setPlannedExercises)
  const assignExercise = useRoutineStore((s) => s.assignExercise)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('All')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  /** `'new'` while creating an exercise, the exercise while editing it, else null. */
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const [adding, setAdding] = useState(false)
  /** Whether the detail sheet is showing its routine list instead of its main actions. */
  const [pickingRoutine, setPickingRoutine] = useState(false)
  const [namingRoutine, setNamingRoutine] = useState(false)
  const library = useMemo(() => buildLibrary(exercises), [exercises])
  // Looked up by key so the sheet reflects edits and first-time copies as they happen.
  const selectedDetail = library.find((item) => item.key === selectedKey) ?? null
  useBodyScrollLock(selectedDetail !== null)

  const closeDetail = () => {
    setSelectedKey(null)
    setPickingRoutine(false)
    setNamingRoutine(false)
  }

  const today = getDayOfWeek(todayString())
  const todayAssignedIds = getPlannedExerciseIds(todayString(), activeRoutine, todaySession)

  const filteredWorkouts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return library.filter((workout) => {
      const matchesSearch = query === '' || workout.name.toLowerCase().includes(query)
      const matchesGroup =
        selectedGroup === 'All' || workout.targetMuscleGroups.some((m) => regionOf(m) === selectedGroup)
      return matchesSearch && matchesGroup
    })
  }, [library, searchQuery, selectedGroup])

  /** The user's exercise for a row, creating their copy of a catalog entry on first use. */
  const ensureExercise = async (item: LibraryItem): Promise<Exercise> =>
    item.exercise ?? (await ensureExerciseFromLibrary(item.catalog!))

  const handleDelete = async (exercise: Exercise) => {
    if (!confirm(`Delete "${exercise.name}"? It will also disappear from any day or routine it's on.`)) return
    try {
      await deleteExercise(exercise.id)
      closeDetail()
      toast.success(`Deleted ${exercise.name}`)
    } catch (err) {
      console.error('Failed to delete exercise:', err)
      toast.error('Failed to delete exercise')
    }
  }

  const handleAddToToday = async () => {
    if (!selectedDetail) return
    setAdding(true)
    try {
      const exerciseId = (await ensureExercise(selectedDetail)).id

      if (todayAssignedIds.includes(exerciseId)) {
        toast('Already in today’s plan')
      } else if (todaySession?.plannedExerciseIds) {
        // Today was swapped to a different routine, so the weekly program isn't what's showing.
        await setPlannedExercises(todayString(), [...todaySession.plannedExerciseIds, exerciseId])
        toast.success('Added to today’s workout')
      } else {
        await assignExercise(today, exerciseId)
        toast.success('Added to today’s workout')
      }
      closeDetail()
    } catch (err) {
      console.error('Failed to add to today:', err)
      toast.error('Failed to add to today')
    } finally {
      setAdding(false)
    }
  }

  /** Adds the open library entry to an existing routine, or to a new one named `newName`. */
  const handleAddToRoutine = async (target: WorkoutTemplate | { newName: string }) => {
    if (!selectedDetail) return
    setAdding(true)
    try {
      const exerciseId = (await ensureExercise(selectedDetail)).id
      if ('newName' in target) {
        await createTemplate(target.newName, [exerciseId])
        toast.success(`Created ${target.newName} with ${selectedDetail.name}`)
      } else {
        await setTemplateExercises(target.id, [...target.exerciseIds, exerciseId])
        toast.success(`Added to ${target.name}`)
      }
      closeDetail()
    } catch (err) {
      console.error('Failed to add to routine:', err)
      toast.error('Failed to add to routine')
    } finally {
      setAdding(false)
    }
  }

  const selectedExerciseId = selectedDetail?.exercise?.id
  const isCustom = selectedDetail !== null && !selectedDetail.catalog

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exercises"
            aria-label="Search workout library"
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

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTER_GROUPS.map((group) => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              aria-pressed={selectedGroup === group}
              className={
                selectedGroup === group
                  ? 'flex-none px-3.5 py-1.5 rounded-full text-xs font-semibold bg-accent text-canvas border border-accent'
                  : 'flex-none px-3.5 py-1.5 rounded-full text-xs font-semibold bg-transparent text-ink-muted border border-surface-border'
              }
            >
              {group}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-muted">
          {filteredWorkouts.length} {filteredWorkouts.length === 1 ? 'exercise' : 'exercises'}
        </span>
        <button onClick={() => setEditing('new')} className="btn-ghost !px-2.5 !py-1 text-xs">
          <Plus size={14} strokeWidth={2.5} />
          Add exercise
        </button>
      </div>

      {filteredWorkouts.length === 0 ? (
        <div className="card-pad text-center py-14">
          <div className="empty-blob">🔍</div>
          <p className="text-ink font-semibold">No matches</p>
          <p className="text-ink-muted text-sm mt-1">Try a different search term or muscle group.</p>
        </div>
      ) : (
        <div className="space-y-2 stagger-children">
          {filteredWorkouts.map((workout) => {
            const groupStyle = muscleGroupStyle(workout.targetMuscleGroups[0] ?? '')
            return (
              <div
                key={workout.key}
                onClick={() => setSelectedKey(workout.key)}
                role="button"
                className="card card-hover animate-pop-in flex items-center gap-3 p-3 cursor-pointer"
              >
                {/* Same icon for every exercise, tinted by its main muscle group. */}
                <div
                  className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-none ${groupStyle.badge}`}
                >
                  <Dumbbell size={17} strokeWidth={2} className={groupStyle.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-ink truncate">{workout.name}</h3>
                  <div className="text-xs text-ink-muted mt-0.5 truncate">
                    {workout.targetSets}×{workout.targetReps} · {workout.targetMuscleGroups.slice(0, 2).join(', ')}
                  </div>
                </div>
                {!workout.catalog && <span className="badge-muted flex-none">Custom</span>}
                <ChevronRight size={16} className="text-ink-faint flex-none" />
              </div>
            )
          })}
        </div>
      )}

      {selectedDetail &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeDetail()
            }}
          >
            <div className="modal-panel">
              <div className="p-6">
                <h2 className="text-ink text-lg mb-1">{selectedDetail.name}</h2>
                <p className="text-sm text-ink-muted mb-4">
                  Target: {selectedDetail.targetSets}×{selectedDetail.targetReps}
                </p>
                {selectedDetail.description && (
                  <p className="text-sm text-ink-muted mb-4">{selectedDetail.description}</p>
                )}
                <div className="mb-4">
                  <ExercisePreview
                    targetMuscleGroups={selectedDetail.targetMuscleGroups}
                    pattern={selectedDetail.catalog?.movementPattern}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {selectedDetail.targetMuscleGroups.map((group) => (
                    <span key={group} className={`badge ${muscleGroupStyle(group).badge}`}>
                      {group}
                    </span>
                  ))}
                </div>
                {pickingRoutine ? (
                  <div className="space-y-3">
                    <span className="field-label">Add to routine</span>
                    {templates.length > 0 && (
                      <ul className="divide-y divide-surface-border">
                        {templates.map((template) => {
                          const included = selectedExerciseId !== undefined && template.exerciseIds.includes(selectedExerciseId)
                          const count = template.exerciseIds.length
                          return (
                            <li key={template.id}>
                              <button
                                onClick={() => handleAddToRoutine(template)}
                                disabled={adding || included}
                                aria-label={included ? `Already in ${template.name}` : `Add to ${template.name}`}
                                className="w-full flex items-center justify-between gap-3 py-2.5 text-left disabled:opacity-60"
                              >
                                <span className="min-w-0">
                                  <span className="block text-sm text-ink truncate">{template.name}</span>
                                  <span className="block text-[11px] text-ink-muted">
                                    {count} {count === 1 ? 'exercise' : 'exercises'}
                                  </span>
                                </span>
                                {included ? (
                                  <span className="flex items-center gap-1 text-xs text-ink-muted flex-none">
                                    <Check size={14} strokeWidth={2.5} />
                                    Added
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-accent flex-none">Add</span>
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    {namingRoutine ? (
                      <InlineNameForm
                        label="Routine name"
                        onSave={(name) => handleAddToRoutine({ newName: name })}
                        onCancel={() => setNamingRoutine(false)}
                      />
                    ) : (
                      <>
                        <button className="btn-secondary w-full" onClick={() => setNamingRoutine(true)}>
                          + New routine
                        </button>
                        <button className="btn-ghost w-full" onClick={() => setPickingRoutine(false)}>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <button className="btn-primary flex-1" disabled={adding} onClick={handleAddToToday}>
                        {adding ? 'Adding...' : 'Add to today'}
                      </button>
                      <button className="btn-primary flex-1" disabled={adding} onClick={() => setPickingRoutine(true)}>
                        Add to routine
                      </button>
                    </div>
                    {isCustom && selectedDetail.exercise && (
                      <div className="flex gap-3">
                        <button
                          className="btn-secondary flex-1"
                          onClick={() => {
                            setEditing(selectedDetail.exercise!)
                            closeDetail()
                          }}
                        >
                          <Pencil size={14} strokeWidth={2} />
                          Edit
                        </button>
                        <button className="btn-danger flex-1" onClick={() => handleDelete(selectedDetail.exercise!)}>
                          <Trash2 size={14} strokeWidth={2} />
                          Delete
                        </button>
                      </div>
                    )}
                    <button className="btn-secondary w-full" onClick={closeDetail}>
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {editing && (
        <ExerciseForm
          exercise={editing === 'new' ? null : editing}
          onSubmit={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
