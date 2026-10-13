import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useRoutineStore, selectActiveRoutine } from '@/stores/routine'
import { useExercisesStore } from '@/stores/exercises'
import { useWorkoutTemplatesStore } from '@/stores/workoutTemplates'
import { DayPlanCard } from './DayPlanCard'

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

/**
 * Full-screen "Weekly plan" editor: one expandable card per day of the week, each
 * showing its currently assigned routines and individual exercises as removable chips
 * and, when expanded, toggle-grids of every routine and of the whole exercise library to
 * add more. Always edits the active program — switching *which* program is active
 * happens in Profile, one level up.
 */
export function RoutineBuilder({ onClose }: { onClose: () => void }) {
  const routines = useRoutineStore((s) => s.routines)
  const activeRoutine = selectActiveRoutine(routines)
  const assignExercise = useRoutineStore((s) => s.assignExercise)
  const removeExercise = useRoutineStore((s) => s.removeExercise)
  const assignTemplate = useRoutineStore((s) => s.assignTemplate)
  const removeTemplate = useRoutineStore((s) => s.removeTemplate)
  const exercises = useExercisesStore((s) => s.exercises)
  const templates = useWorkoutTemplatesStore((s) => s.templates)

  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async (day: string, exerciseId: string) => {
    try {
      await assignExercise(day, exerciseId)
    } catch (err) {
      console.error('Failed to add exercise:', err)
      setError('Failed to add exercise. Please try again.')
    }
  }

  const handleRemove = async (day: string, exerciseId: string) => {
    try {
      await removeExercise(day, exerciseId)
    } catch (err) {
      console.error('Failed to remove exercise:', err)
      setError('Failed to remove exercise. Please try again.')
    }
  }

  const handleToggleTemplate = async (day: string, templateId: string, assign: boolean) => {
    try {
      await (assign ? assignTemplate(day, templateId) : removeTemplate(day, templateId))
    } catch (err) {
      console.error('Failed to update routine assignment:', err)
      setError('Failed to update the day. Please try again.')
    }
  }

  return createPortal(
    // z-55, deliberately below .modal-overlay's z-60 — DayPlanCard doesn't open a modal
    // itself, but staying under that threshold keeps this sheet consistent with
    // ExerciseManagerSheet, which does.
    <div className="fixed inset-0 z-[55] bg-canvas flex flex-col">
      <div className="flex-none pwa-safe-top flex items-center justify-between px-5 py-4 border-b border-surface-border">
        <h3 className="text-ink">Weekly plan</h3>
        <button onClick={onClose} className="btn-icon" aria-label="Close">
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pwa-safe-bottom">
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

        {DAYS.map((day) => {
          const assignedIds = activeRoutine?.weeklyAssignments[day.key] ?? []
          const assignedExercises = assignedIds
            .map((id) => exercises.find((e) => e.id === id))
            .filter((ex): ex is NonNullable<typeof ex> => ex !== undefined)
          const assignedTemplates = (activeRoutine?.weeklyTemplates?.[day.key] ?? [])
            .map((id) => templates.find((t) => t.id === id))
            .filter((t): t is NonNullable<typeof t> => t !== undefined)

          return (
            <DayPlanCard
              key={day.key}
              label={day.label}
              assignedTemplates={assignedTemplates}
              assignedExercises={assignedExercises}
              allTemplates={templates}
              allExercises={exercises}
              expanded={expandedDay === day.key}
              onToggleExpand={() => setExpandedDay((d) => (d === day.key ? null : day.key))}
              onAddTemplate={(templateId) => handleToggleTemplate(day.key, templateId, true)}
              onRemoveTemplate={(templateId) => handleToggleTemplate(day.key, templateId, false)}
              onAdd={(exerciseId) => handleAdd(day.key, exerciseId)}
              onRemove={(exerciseId) => handleRemove(day.key, exerciseId)}
            />
          )
        })}
      </div>
    </div>,
    document.body
  )
}
