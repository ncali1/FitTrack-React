import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { FormEvent } from 'react'
import type { ExercisePerformance, DifficultyLevel } from '@/types'
import { useSettingsStore } from '@/stores/settings'
import { fromKg, toKg } from '@/utils/units'
import type { PerformanceSuggestion } from '@/utils/progressiveOverload'
import { calculatePlateLoading, formatPlateBreakdown } from '@/utils/plateCalculator'

interface FormData {
  actualSets: number | null
  actualReps: number | null
  weight: number | null
  difficultyLevel: DifficultyLevel | null
  rpe: number | null
  isWarmup: boolean
}

type FormErrors = Partial<Record<keyof FormData, string>>

const DIFFICULTY_LEVELS: { value: DifficultyLevel; label: string; activeClass: string }[] = [
  { value: 'easy', label: 'Easy', activeClass: 'bg-lime-500/15 border-lime-500 text-lime-500' },
  { value: 'moderate', label: 'Moderate', activeClass: 'bg-amber-500/15 border-amber-500 text-amber-400' },
  { value: 'hard', label: 'Hard', activeClass: 'bg-red-500/15 border-red-500 text-red-400' },
]

/** 6-10 in half-point steps — the conventional RPE range for a working set. */
const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

/**
 * Form for logging actual performance data (sets, reps, optional weight, difficulty
 * level) after marking an exercise as completed. Pre-fills from `existingPerformance`
 * when editing a previously logged entry. Callers should mount this with
 * `key={existingPerformance?.timestamp ?? 'new'}` so switching which exercise/entry is
 * being logged resets form state via remount.
 *
 * Renders as a modal by default (the ad-hoc checklist-tap flow); pass `inline` to render
 * just the card content with no overlay/backdrop, for embedding directly in a page flow
 * like the guided session's per-exercise logging step. `onCancel` is optional in that
 * mode since there's often no "back out" affordance mid-session.
 *
 * When there's no `existingPerformance` (a fresh log, not an edit), an optional
 * `suggestion` — from `suggestNextPerformance`, based on this exercise's history —
 * pre-fills the fields instead of leaving them blank, with its rationale shown above
 * the form.
 */
export function PerformanceForm({
  exerciseName,
  targetSets,
  targetReps,
  notes,
  existingPerformance,
  suggestion,
  onSubmit,
  onCancel,
  inline = false,
  submitLabel,
}: {
  exerciseId: string
  exerciseName: string
  targetSets: number
  targetReps: number
  /** The exercise's own saved notes (form cues, a video link) — not the same as `suggestion.note`. */
  notes?: string
  existingPerformance?: ExercisePerformance | null
  suggestion?: PerformanceSuggestion | null
  onSubmit: (performance: Omit<ExercisePerformance, 'exerciseId' | 'timestamp'>) => void
  onCancel?: () => void
  inline?: boolean
  submitLabel?: string
}) {
  const weightUnit = useSettingsStore((s) => s.weightUnit)

  const [form, setForm] = useState<FormData>(() => {
    if (existingPerformance) {
      return {
        actualSets: existingPerformance.actualSets ?? null,
        actualReps: existingPerformance.actualReps ?? null,
        weight: fromKg(existingPerformance.weight, weightUnit),
        difficultyLevel: existingPerformance.difficultyLevel ?? null,
        rpe: existingPerformance.rpe ?? null,
        isWarmup: existingPerformance.isWarmup ?? false,
      }
    }
    if (suggestion) {
      return {
        actualSets: suggestion.actualSets,
        actualReps: suggestion.actualReps,
        weight: fromKg(suggestion.weight, weightUnit),
        difficultyLevel: null,
        rpe: null,
        isWarmup: false,
      }
    }
    return { actualSets: null, actualReps: null, weight: null, difficultyLevel: null, rpe: null, isWarmup: false }
  })
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
        rpe: form.rpe ?? undefined,
        isWarmup: form.isWarmup || undefined,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const content = (
    <div className={inline ? 'card-pad' : 'p-6'}>
      <h2 className="text-ink text-lg mb-1">Log Performance</h2>
      <p className="text-sm text-ink-muted mb-1.5">
        {exerciseName}
        <span className="ml-1 text-ink-faint">
          (target: {targetSets}×{targetReps})
        </span>
      </p>
      {notes && (
        <p className="text-xs text-ink-muted bg-canvas-800 border border-surface-border rounded-lg px-3 py-2 mb-3.5">
          {notes}
        </p>
      )}
      {!existingPerformance && suggestion && (
        <p className="text-xs text-accent-400 mb-3.5">{suggestion.note}</p>
      )}

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

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isWarmup}
            onChange={(e) => setForm((prev) => ({ ...prev, isWarmup: e.target.checked }))}
            className="w-4 h-4 accent-accent-500"
          />
          <span className="text-sm text-ink-muted">
            Warm-up set{' '}
            <span className="text-ink-faint">— excluded from PRs, volume, and suggestions</span>
          </span>
        </label>

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
          {!errors.weight && form.weight != null && form.weight > 0 && (
            <p className="text-xs text-ink-faint mt-1.5">
              {formatPlateBreakdown(calculatePlateLoading(form.weight, weightUnit), weightUnit)}
            </p>
          )}
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

        {/* RPE — optional, more granular alternative alongside Difficulty */}
        <div>
          <span className="field-label">
            RPE <span className="text-ink-faint normal-case font-normal">optional</span>
          </span>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {RPE_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, rpe: prev.rpe === value ? null : value }))}
                aria-pressed={form.rpe === value}
                className={
                  form.rpe === value
                    ? 'flex-none px-3 py-1.5 rounded-full text-xs font-semibold bg-accent text-canvas border border-accent'
                    : 'flex-none px-3 py-1.5 rounded-full text-xs font-semibold bg-transparent text-ink-muted border border-surface-border'
                }
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">
              Cancel
            </button>
          )}
          <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
            {isSubmitting ? 'Saving...' : (submitLabel ?? 'Save')}
          </button>
        </div>
      </form>
    </div>
  )

  if (inline) return content

  // Portaled to <body> — an ancestor tab-content wrapper has a lingering `transform`
  // (from its entrance animation's fill-mode) which, like TopBar's backdrop-blur,
  // creates a containing block for `position: fixed` descendants. Without the portal
  // this modal resolves "fixed" against that ancestor instead of the viewport.
  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.()
      }}
    >
      <div className="modal-panel">{content}</div>
    </div>,
    document.body
  )
}
