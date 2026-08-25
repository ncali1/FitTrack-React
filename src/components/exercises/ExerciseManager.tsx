import { useEffect } from 'react'
import { useExercisesStore } from '@/stores/exercises'
import { ExerciseList } from './ExerciseList'

/**
 * Container component for the exercise library. Loads all exercises on mount, displays
 * a loading spinner while fetching, shows any store-level errors, and delegates
 * rendering of the list (and CRUD actions) to ExerciseList.
 */
export function ExerciseManager() {
  const error = useExercisesStore((s) => s.error)
  const loading = useExercisesStore((s) => s.loading)
  const loadExercises = useExercisesStore((s) => s.loadExercises)

  useEffect(() => {
    loadExercises()
  }, [loadExercises])

  return (
    <div className="space-y-4">
      {error && (
        <div className="alert-error">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-surface-border border-t-accent-500 rounded-full animate-spin" />
        </div>
      ) : (
        <ExerciseList />
      )}
    </div>
  )
}
