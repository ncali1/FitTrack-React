import { useMemo, useState } from 'react'
import { Search, X, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useExercisesStore } from '@/stores/exercises'
import { muscleGroupStyle } from '@/utils/muscleGroupStyles'
import { WORKOUT_LIBRARY, type LibraryWorkout } from '@/data/workoutLibrary'
import { MuscleBodyDiagram } from './MuscleBodyDiagram'

function WorkoutCard({ workout, alreadyAdded }: { workout: LibraryWorkout; alreadyAdded: boolean }) {
  const createExercise = useExercisesStore((s) => s.createExercise)
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    setAdding(true)
    try {
      await createExercise(workout.name, workout.targetSets, workout.targetReps, [...workout.targetMuscleGroups])
      toast.success(`${workout.name} added to your exercises`)
    } catch (err) {
      console.error('Failed to add workout to exercises:', err)
      toast.error('Failed to add workout')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <MuscleBodyDiagram targetMuscleGroups={workout.targetMuscleGroups} pattern={workout.movementPattern} />

      <h3 className="text-base font-semibold text-ink mt-3">{workout.name}</h3>
      <p className="text-ink-muted text-xs mt-1 leading-relaxed">{workout.description}</p>

      <div className="flex gap-3 text-xs text-ink-muted mt-3 flex-wrap">
        <span className="badge-muted">Sets: {workout.targetSets}</span>
        <span className="badge-muted">Reps: {workout.targetReps}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
        {workout.targetMuscleGroups.map((group) => (
          <span key={group} className={`badge ${muscleGroupStyle(group).badge}`}>
            {group}
          </span>
        ))}
      </div>

      <button
        onClick={handleAdd}
        disabled={adding || alreadyAdded}
        className={alreadyAdded ? 'btn-secondary w-full mt-auto' : 'btn-primary w-full mt-auto'}
      >
        {alreadyAdded ? (
          <>
            <Check size={16} strokeWidth={2.5} />
            Added
          </>
        ) : (
          <>
            <Plus size={16} strokeWidth={2.5} />
            {adding ? 'Adding...' : 'Add to Workout'}
          </>
        )}
      </button>
    </div>
  )
}

/**
 * Browsable catalog of predefined exercises (independent of the user's own Exercise
 * Manager entries), with a front/back muscle diagram highlighting each one's targeted
 * regions in red. "Add to Workout" copies it into the user's own Exercises list — the
 * same effect as creating it manually via ExerciseForm.
 */
export function WorkoutLibrary() {
  const exercises = useExercisesStore((s) => s.exercises)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('All')

  const addedNames = useMemo(() => new Set(exercises.map((ex) => ex.name.toLowerCase())), [exercises])

  const muscleGroups = useMemo(() => {
    const groups = new Set<string>()
    WORKOUT_LIBRARY.forEach((workout) => workout.targetMuscleGroups.forEach((group) => groups.add(group)))
    return Array.from(groups).sort()
  }, [])

  const filteredWorkouts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return WORKOUT_LIBRARY.filter((workout) => {
      const matchesSearch = query === '' || workout.name.toLowerCase().includes(query)
      const matchesGroup = selectedGroup === 'All' || workout.targetMuscleGroups.includes(selectedGroup)
      return matchesSearch && matchesGroup
    })
  }, [searchQuery, selectedGroup])

  return (
    <div className="space-y-5">
      <div className="section-header">
        <div>
          <h2 className="text-ink">Workout Library</h2>
          <p className="text-ink-muted text-sm mt-0.5">Explore exercises and add the ones you want to try.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the library..."
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

      {filteredWorkouts.length === 0 ? (
        <div className="card-pad text-center py-14">
          <div className="empty-blob">🔍</div>
          <p className="text-ink font-semibold">No matches</p>
          <p className="text-ink-muted text-sm mt-1">Try a different search term or muscle group.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filteredWorkouts.map((workout) => (
            <div key={workout.id} className="card-pad card-hover animate-pop-in">
              <WorkoutCard workout={workout} alreadyAdded={addedNames.has(workout.name.toLowerCase())} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
