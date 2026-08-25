import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useExercisesStore } from '@/stores/exercises'

/**
 * Displays a dropdown of exercises not yet assigned to the current day and a list of
 * already-selected exercises.
 */
export function ExerciseSelector({
  day,
  selectedExercises,
  onAddExercise,
  onRemoveExercise,
}: {
  day: string
  selectedExercises: string[]
  onAddExercise: (exerciseId: string) => void
  onRemoveExercise: (exerciseId: string) => void
}) {
  const exercises = useExercisesStore((s) => s.exercises)
  const [selectedExerciseId, setSelectedExerciseId] = useState('')

  const dayLabel = day.charAt(0).toUpperCase() + day.slice(1)
  const availableExercises = exercises.filter((ex) => !selectedExercises.includes(ex.id))

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const exerciseId = e.target.value
    setSelectedExerciseId(exerciseId)
    if (exerciseId) {
      onAddExercise(exerciseId)
      setSelectedExerciseId('')
    }
  }

  const getExerciseName = (exerciseId: string) =>
    exercises.find((e) => e.id === exerciseId)?.name || 'Unknown Exercise'

  return (
    <div className="card-pad">
      <h3 className="text-ink mb-4">
        Add exercises to <span className="text-accent-400">{dayLabel}</span>
      </h3>

      <div className="mb-5">
        <label className="field-label" htmlFor="exercise-select">
          Available Exercises
        </label>
        <select id="exercise-select" value={selectedExerciseId} onChange={handleChange} className="field-input">
          <option value="">-- Select an exercise --</option>
          {availableExercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name} ({exercise.targetSets}x{exercise.targetReps})
            </option>
          ))}
        </select>
      </div>

      {selectedExercises.length > 0 ? (
        <div className="space-y-2">
          <h4 className="field-label !mb-2">Selected Exercises</h4>
          {selectedExercises.map((exerciseId) => (
            <div
              key={exerciseId}
              className="flex items-center justify-between bg-canvas-800 border border-surface-border p-3 rounded-xl"
            >
              <span className="text-ink text-sm font-medium">{getExerciseName(exerciseId)}</span>
              <button
                onClick={() => onRemoveExercise(exerciseId)}
                className="text-red-400 hover:text-red-300 text-xs font-semibold"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-ink-faint text-sm">No exercises selected yet</div>
      )}
    </div>
  )
}
