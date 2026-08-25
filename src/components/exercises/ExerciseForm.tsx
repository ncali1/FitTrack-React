import { useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { useExercisesStore } from '@/stores/exercises'
import type { Exercise } from '@/types'
import { validateExerciseName, validateSets, validateReps, validateMuscleGroups } from '@/utils/validators'
import { muscleGroupStyle } from '@/utils/muscleGroupStyles'

interface FormData {
  name: string
  targetSets: number
  targetReps: number
  targetMuscleGroups: string[]
}

type FormErrors = Partial<Record<keyof FormData, string>>

/** Canonical set of muscle group names usable across the app — kept here since this form is their point of entry. */
export const MUSCLE_GROUP_OPTIONS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Legs',
  'Quadriceps',
  'Hamstrings',
  'Calves',
  'Glutes',
  'Core',
]

function blankForm(): FormData {
  return { name: '', targetSets: 3, targetReps: 10, targetMuscleGroups: [] }
}

function toFormData(exercise: Exercise): FormData {
  return {
    name: exercise.name,
    targetSets: exercise.targetSets,
    targetReps: exercise.targetReps,
    targetMuscleGroups: [...exercise.targetMuscleGroups],
  }
}

/**
 * Modal form for creating a new exercise or editing an existing one. When `exercise` is
 * provided the form is pre-populated for editing; otherwise it starts blank for creation.
 * Callers should mount this with `key={exercise?.id ?? 'new'}` so switching which
 * exercise is being edited resets form state via remount rather than an effect.
 */
export function ExerciseForm({
  exercise,
  onSubmit,
  onCancel,
}: {
  exercise?: Exercise | null
  onSubmit: () => void
  onCancel: () => void
}) {
  const createExercise = useExercisesStore((s) => s.createExercise)
  const updateExercise = useExercisesStore((s) => s.updateExercise)

  const [form, setForm] = useState<FormData>(() => (exercise ? toFormData(exercise) : blankForm()))
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const validateField = (field: keyof FormData, data: FormData): string | undefined => {
    if (field === 'name') return validateExerciseName(data.name).error
    if (field === 'targetSets') return validateSets(data.targetSets).error
    if (field === 'targetReps') return validateReps(data.targetReps).error
    if (field === 'targetMuscleGroups') return validateMuscleGroups(data.targetMuscleGroups).error
    return undefined
  }

  const handleBlur = (field: keyof FormData) => {
    setErrors((prev) => ({ ...prev, [field]: validateField(field, form) }))
  }

  const toggleMuscleGroup = (group: string) => {
    setForm((prev) => ({
      ...prev,
      targetMuscleGroups: prev.targetMuscleGroups.includes(group)
        ? prev.targetMuscleGroups.filter((g) => g !== group)
        : [...prev.targetMuscleGroups, group],
    }))
  }

  const validateAll = (data: FormData): FormErrors => ({
    name: validateField('name', data),
    targetSets: validateField('targetSets', data),
    targetReps: validateField('targetReps', data),
    targetMuscleGroups: validateField('targetMuscleGroups', data),
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const nextErrors = validateAll(form)
    setErrors(nextErrors)
    if (Object.values(nextErrors).some((err) => err !== undefined)) return

    try {
      setIsSubmitting(true)
      setSubmitError(null)

      if (exercise) {
        const updated = await updateExercise(exercise.id, {
          name: form.name,
          targetSets: form.targetSets,
          targetReps: form.targetReps,
          targetMuscleGroups: [...form.targetMuscleGroups],
        })
        toast.success(`${updated.name} updated`)
      } else {
        const created = await createExercise(form.name, form.targetSets, form.targetReps, [...form.targetMuscleGroups])
        toast.success(`${created.name} created`)
      }

      onSubmit()
    } catch (err) {
      console.error('Failed to save exercise:', err)
      setSubmitError('Failed to save exercise. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="modal-panel">
        <div className="p-6">
          <h2 className="text-ink mb-5">{exercise ? 'Edit Exercise' : 'Create Exercise'}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="field-label">
                Exercise Name *
              </label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                onBlur={() => handleBlur('name')}
                placeholder="e.g., Bench Press"
                className="field-input"
              />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>

            {/* Target Sets / Reps side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="targetSets" className="field-label">
                  Target Sets *
                </label>
                <input
                  id="targetSets"
                  type="number"
                  min={1}
                  value={form.targetSets}
                  onChange={(e) => setForm((prev) => ({ ...prev, targetSets: Number(e.target.value) }))}
                  onBlur={() => handleBlur('targetSets')}
                  placeholder="3"
                  className="field-input"
                />
                {errors.targetSets && <p className="field-error">{errors.targetSets}</p>}
              </div>

              <div>
                <label htmlFor="targetReps" className="field-label">
                  Target Reps *
                </label>
                <input
                  id="targetReps"
                  type="number"
                  min={1}
                  value={form.targetReps}
                  onChange={(e) => setForm((prev) => ({ ...prev, targetReps: Number(e.target.value) }))}
                  onBlur={() => handleBlur('targetReps')}
                  placeholder="10"
                  className="field-input"
                />
                {errors.targetReps && <p className="field-error">{errors.targetReps}</p>}
              </div>
            </div>

            {/* Muscle Groups Field */}
            <div>
              <span className="field-label">Target Muscle Groups *</span>
              <div className="flex flex-wrap gap-2">
                {MUSCLE_GROUP_OPTIONS.map((group) => {
                  const selected = form.targetMuscleGroups.includes(group)
                  const style = muscleGroupStyle(group)
                  return (
                    <label
                      key={group}
                      className={
                        selected
                          ? `px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all duration-150 select-none active:scale-95 ${style.pill}`
                          : 'px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all duration-150 select-none active:scale-95 bg-canvas-800 border-surface-border text-ink-muted hover:border-ink-faint hover:text-ink'
                      }
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selected}
                        onChange={() => toggleMuscleGroup(group)}
                      />
                      {group}
                    </label>
                  )
                })}
              </div>
              {errors.targetMuscleGroups && <p className="field-error">{errors.targetMuscleGroups}</p>}
            </div>

            {/* Submit Error Banner */}
            {submitError && (
              <div className="alert-error">
                <p className="text-red-400 text-sm">{submitError}</p>
                <button
                  type="button"
                  onClick={() => setSubmitError(null)}
                  className="text-red-400 hover:text-red-300 ml-2 text-lg leading-none"
                  aria-label="Dismiss error"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onCancel} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
