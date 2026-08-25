import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ExercisePerformance, DifficultyLevel } from '@/types'
import { useSettingsStore } from '@/stores/settings'
import { fromKg, toKg } from '@/utils/units'

interface FormData {
  actualSets: number | null
  actualReps: number | null
  weight: number | null
  difficultyLevel: DifficultyLevel | null
}

type FormErrors = Partial<Record<keyof FormData, string>>

const DIFFICULTY_LEVELS: { value: DifficultyLevel; label: string; activeClass: string }[] = [
  { value: 'easy', label: 'Easy', activeClass: 'bg-lime-500/15 border-lime-500 text-lime-500' },
  { value: 'moderate', label: 'Moderate', activeClass: 'bg-amber-500/15 border-amber-500 text-amber-400' },
  { value: 'hard', label: 'Hard', activeClass: 'bg-red-500/15 border-red-500 text-red-400' },
]

/**
 * Modal form for logging actual performance data (sets, reps, optional weight,
 * difficulty level) after marking an exercise as completed. Pre-fills from
 * `existingPerformance` when editing a previously logged entry. Callers should mount
 * this with `key={existingPerformance?.timestamp ?? 'new'}` so switching which
 * exercise/entry is being logged resets form state via remount.
 */
export function PerformanceForm({
  exerciseName,
  targetSets,
  targetReps,
  existingPerformance,
  onSubmit,
  onCancel,
}: {
  exerciseId: string
  exerciseName: string
  targetSets: number
  targetReps: number
  existingPerformance?: ExercisePerformance | null
  onSubmit: (performance: Omit<ExercisePerformance, 'exerciseId' | 'timestamp'>) => void
  onCancel: () => void
}) {
  const weightUnit = useSettingsStore((s) => s.weightUnit)

  const [form, setForm] = useState<FormData>(() =>
    existingPerformance
      ? {
          actualSets: existingPerformance.actualSets ?? null,
          actualReps: existingPerformance.actualReps ?? null,
          weight: fromKg(existingPerformance.weight, weightUnit),
          difficultyLevel: existingPerformance.difficultyLevel ?? null,
        }
      : { actualSets: null, actualReps: null, weight: null, difficultyLevel: null }
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateField = (field: keyof FormData, data: FormData): string | undefined => {
    if (field === 'actualSets') {
      if (data.actualSets === null || !Number.isInteger(data.actualSets) || data.actualSets < 1) {
        return 'Sets must be a positive number'
      }
    } else if (field === 'actualReps') {
      if (data.actualReps === null || !Number.isInteger(data.actualReps) || data.actualReps < 1) {
        return 'Reps must be a positive number'
      }
    } else if (field === 'weight') {
      if (data.weight !== null && data.weight < 0) return 'Weight must be a positive number'
    } else if (field === 'difficultyLevel') {
      if (!data.difficultyLevel) return 'Difficulty level is required'
    }
    return undefined
  }

  const handleBlur = (field: keyof FormData) => {
    setErrors((prev) => ({ ...prev, [field]: validateField(field, form) }))
  }

  const numberOrNull = (value: string): number | null => (value === '' ? null : Number(value))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    const nextErrors: FormErrors = {
      actualSets: validateField('actualSets', form),
      actualReps: validateField('actualReps', form),
      weight: validateField('weight', form),
      difficultyLevel: validateField('difficultyLevel', form),
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some((err) => err !== undefined)) return

    try {
      setIsSubmitting(true)
      onSubmit({
        completed: true,
        actualSets: form.actualSets!,
        actualReps: form.actualReps!,
        weight: toKg(form.weight, weightUnit) ?? undefined,
        difficultyLevel: form.difficultyLevel!,
      })
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
          <h2 className="text-ink text-lg mb-1">Log Performance</h2>
          <p className="text-sm text-ink-muted mb-5">
            {exerciseName}
            <span className="ml-1 text-ink-faint">
              (target: {targetSets}×{targetReps})
            </span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="actualSets" className="field-label">
                  Actual Sets *
                </label>
                <input
                  id="actualSets"
                  type="number"
                  min={1}
                  value={form.actualSets ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, actualSets: numberOrNull(e.target.value) }))}
                  onBlur={() => handleBlur('actualSets')}
                  placeholder="3"
                  className="field-input"
                />
                {errors.actualSets && <p className="field-error">{errors.actualSets}</p>}
              </div>

              <div>
                <label htmlFor="actualReps" className="field-label">
                  Actual Reps *
                </label>
                <input
                  id="actualReps"
                  type="number"
                  min={1}
                  value={form.actualReps ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, actualReps: numberOrNull(e.target.value) }))}
                  onBlur={() => handleBlur('actualReps')}
                  placeholder="10"
                  className="field-input"
                />
                {errors.actualReps && <p className="field-error">{errors.actualReps}</p>}
              </div>
            </div>

            {/* Weight (optional) */}
            <div>
              <label htmlFor="weight" className="field-label">
                Weight ({weightUnit}) <span className="text-ink-faint normal-case font-normal">optional</span>
              </label>
              <input
                id="weight"
                type="number"
                min={0}
                step={0.5}
                value={form.weight ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, weight: numberOrNull(e.target.value) }))}
                onBlur={() => handleBlur('weight')}
                placeholder={weightUnit === 'kg' ? 'e.g., 60' : 'e.g., 135'}
                className="field-input"
              />
              {errors.weight && <p className="field-error">{errors.weight}</p>}
            </div>

            {/* Difficulty Level */}
            <div>
              <span className="field-label">Difficulty Level *</span>
              <div className="flex gap-2">
                {DIFFICULTY_LEVELS.map((level) => (
                  <label
                    key={level.value}
                    className={
                      form.difficultyLevel === level.value
                        ? `flex-1 flex items-center justify-center px-3 py-2.5 rounded-xl border cursor-pointer transition-colors text-sm font-semibold ${level.activeClass}`
                        : 'flex-1 flex items-center justify-center px-3 py-2.5 rounded-xl border cursor-pointer transition-colors text-sm font-semibold border-surface-border text-ink-muted hover:border-ink-faint/50'
                    }
                  >
                    <input
                      type="radio"
                      name="difficultyLevel"
                      value={level.value}
                      checked={form.difficultyLevel === level.value}
                      onChange={() => setForm((prev) => ({ ...prev, difficultyLevel: level.value }))}
                      className="sr-only"
                    />
                    {level.label}
                  </label>
                ))}
              </div>
              {errors.difficultyLevel && <p className="field-error">{errors.difficultyLevel}</p>}
            </div>

            {/* Actions */}
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
