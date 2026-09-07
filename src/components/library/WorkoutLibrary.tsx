import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Dumbbell, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useExercisesStore } from '@/stores/exercises'
import { useRoutineStore, selectRoutineForDay } from '@/stores/routine'
import { muscleGroupStyle } from '@/utils/muscleGroupStyles'
import { getDayOfWeek } from '@/utils/calculations'
import { WORKOUT_LIBRARY, type LibraryWorkout } from '@/data/workoutLibrary'

/** Broader region groupings for the filter chips — several raw muscle groups collapse
 *  into one chip (e.g. Biceps/Triceps/Forearms -> Arms) to keep the filter row short. */
const FILTER_GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core']

function regionOf(muscleGroup: string): string {
  if (['Triceps', 'Biceps', 'Forearms'].includes(muscleGroup)) return 'Arms'
  if (['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'].includes(muscleGroup)) return 'Legs'
  return muscleGroup
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Browsable catalog of predefined exercises (independent of the user's own Exercise
 * Manager entries). Tapping a result opens a detail sheet with a single "Add to today"
 * action, which both adds it to the user's exercises (if not already there, the same
 * effect as creating it manually) and assigns it to today's routine day in one step —
 * a shortcut alongside the full weekly editing in Profile's plan builder.
 */
export function WorkoutLibrary() {
  const exercises = useExercisesStore((s) => s.exercises)
  const createExercise = useExercisesStore((s) => s.createExercise)
  const routines = useRoutineStore((s) => s.routines)
  const assignExercise = useRoutineStore((s) => s.assignExercise)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('All')
  const [selectedDetail, setSelectedDetail] = useState<LibraryWorkout | null>(null)
  const [adding, setAdding] = useState(false)

  const today = getDayOfWeek(todayString())
  const todayAssignedIds = selectRoutineForDay(routines, today)

  const filteredWorkouts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return WORKOUT_LIBRARY.filter((workout) => {
      const matchesSearch = query === '' || workout.name.toLowerCase().includes(query)
      const matchesGroup =
        selectedGroup === 'All' || workout.targetMuscleGroups.some((m) => regionOf(m) === selectedGroup)
      return matchesSearch && matchesGroup
    })
  }, [searchQuery, selectedGroup])

  const handleAddToToday = async () => {
    if (!selectedDetail) return
    setAdding(true)
    try {
      const existing = exercises.find((e) => e.name.toLowerCase() === selectedDetail.name.toLowerCase())
      const exerciseId = existing
        ? existing.id
        : (
            await createExercise(
              selectedDetail.name,
              selectedDetail.targetSets,
              selectedDetail.targetReps,
              [...selectedDetail.targetMuscleGroups]
            )
          ).id

      if (todayAssignedIds.includes(exerciseId)) {
        toast('Already in today’s plan')
      } else {
        await assignExercise(today, exerciseId)
        toast.success('Added to today’s workout')
      }
      setSelectedDetail(null)
    } catch (err) {
      console.error('Failed to add to today:', err)
      toast.error('Failed to add to today')
    } finally {
      setAdding(false)
    }
  }

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

      {filteredWorkouts.length === 0 ? (
        <div className="card-pad text-center py-14">
          <div className="empty-blob">🔍</div>
          <p className="text-ink font-semibold">No matches</p>
          <p className="text-ink-muted text-sm mt-1">Try a different search term or muscle group.</p>
        </div>
      ) : (
        <div className="space-y-2 stagger-children">
          {filteredWorkouts.map((workout) => (
            <div
              key={workout.id}
              onClick={() => setSelectedDetail(workout)}
              role="button"
              className="card card-hover animate-pop-in flex items-center gap-3 p-3 cursor-pointer"
            >
              <div className="w-[38px] h-[38px] rounded-[10px] bg-canvas-800 border border-surface-border flex items-center justify-center flex-none">
                <Dumbbell size={17} strokeWidth={2} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-ink truncate">{workout.name}</h3>
                <div className="text-xs text-ink-muted mt-0.5 truncate">
                  {workout.targetSets}×{workout.targetReps} · {workout.targetMuscleGroups.slice(0, 2).join(', ')}
                </div>
              </div>
              <ChevronRight size={16} className="text-ink-faint flex-none" />
            </div>
          ))}
        </div>
      )}

      {selectedDetail &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedDetail(null)
            }}
          >
            <div className="modal-panel">
              <div className="p-6">
                <h2 className="text-ink text-lg mb-1">{selectedDetail.name}</h2>
                <p className="text-sm text-ink-muted mb-4">
                  Target: {selectedDetail.targetSets}×{selectedDetail.targetReps}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {selectedDetail.targetMuscleGroups.map((group) => (
                    <span key={group} className={`badge ${muscleGroupStyle(group).badge}`}>
                      {group}
                    </span>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button className="btn-secondary flex-1" onClick={() => setSelectedDetail(null)}>
                    Close
                  </button>
                  <button className="btn-primary flex-1" disabled={adding} onClick={handleAddToToday}>
                    {adding ? 'Adding...' : 'Add to today'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
