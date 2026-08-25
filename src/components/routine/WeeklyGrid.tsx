import { useRoutineStore, selectRoutineForDay } from '@/stores/routine'
import { useExercisesStore } from '@/stores/exercises'
import type { DayOfWeek } from '@/types'

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/**
 * Renders a 7-day grid of the weekly routine. Each day card shows its assigned
 * exercises and highlights when selected.
 */
export function WeeklyGrid({
  selectedDay,
  onSelectDay,
}: {
  selectedDay: string
  onSelectDay: (day: string) => void
}) {
  const routines = useRoutineStore((s) => s.routines)
  const exercises = useExercisesStore((s) => s.exercises)

  const getExerciseName = (exerciseId: string) =>
    exercises.find((e) => e.id === exerciseId)?.name || 'Unknown Exercise'

  return (
    <div className="card-pad">
      <h2 className="text-ink mb-5">Weekly Routine</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {DAYS.map((day) => {
          const dayExercises = selectRoutineForDay(routines, day)
          const active = selectedDay === day
          return (
            <div
              key={day}
              onClick={() => onSelectDay(day)}
              className={
                active
                  ? 'p-4 rounded-xl border cursor-pointer transition-all border-accent-500 bg-accent-500/10'
                  : 'p-4 rounded-xl border cursor-pointer transition-all border-surface-border bg-canvas-800 hover:border-ink-faint/50'
              }
            >
              <h3 className="font-semibold text-sm mb-3 text-ink capitalize flex items-center justify-between">
                {day}
                {dayExercises.length > 0 && (
                  <span className={`w-2 h-2 rounded-full ${active ? 'bg-accent-500' : 'bg-lime-500'}`} />
                )}
              </h3>

              {dayExercises.length === 0 ? (
                <div className="text-ink-faint text-xs">No exercises assigned</div>
              ) : (
                <div className="space-y-1.5">
                  {dayExercises.map((exerciseId) => (
                    <div
                      key={exerciseId}
                      className="bg-surface-hover px-2.5 py-1.5 rounded-lg text-xs text-ink-muted truncate"
                    >
                      {getExerciseName(exerciseId)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
