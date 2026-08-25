import type { ChangeEvent } from 'react'
import { useExercisesStore } from '@/stores/exercises'

/** A `<select>` dropdown pre-populated from the exercises store, used to pick which
 * exercise to display in the Progress Graphs view. */
export function GraphExerciseSelector({
  value,
  onChange,
}: {
  value: string | null
  onChange: (exerciseId: string | null) => void
}) {
  const exercises = useExercisesStore((s) => s.exercises)

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value || null)
  }

  return (
    <select value={value ?? ''} onChange={handleChange} className="field-input">
      <option value="">-- Select an exercise --</option>
      {exercises.map((exercise) => (
        <option key={exercise.id} value={exercise.id}>
          {exercise.name}
        </option>
      ))}
    </select>
  )
}
