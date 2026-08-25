import { useState } from 'react'
import type { FormEvent } from 'react'
import { useBodyWeightStore } from '@/stores/bodyWeight'
import { useSettingsStore } from '@/stores/settings'
import { toKg } from '@/utils/units'

const today = new Date().toISOString().split('T')[0] as string

/**
 * Small inline form for logging today's (or a past) body weight entry. Accepts input
 * in the user's preferred display unit and converts to canonical kg before saving —
 * logging again on the same date overwrites that date's entry.
 */
export function BodyWeightLogForm() {
  const logWeight = useBodyWeightStore((s) => s.logWeight)
  const weightUnit = useSettingsStore((s) => s.weightUnit)

  const [date, setDate] = useState(today)
  const [weight, setWeight] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (weight == null) return

    try {
      setIsSubmitting(true)
      setSubmitError(null)

      const weightKg = toKg(weight, weightUnit)!
      await logWeight(date, weightKg)

      setWeight(null)
    } catch (err) {
      console.error('Failed to log body weight:', err)
      setSubmitError('Failed to save. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="card-pad">
      <h3 className="mb-4 text-sm font-semibold text-ink-muted uppercase tracking-wide">Log Weight</h3>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
        <div className="min-w-40">
          <label htmlFor="bw-date" className="field-label">
            Date
          </label>
          <input
            id="bw-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            type="date"
            max={today}
            className="field-input"
          />
        </div>

        <div className="min-w-32">
          <label htmlFor="bw-weight" className="field-label">
            Weight ({weightUnit})
          </label>
          <input
            id="bw-weight"
            value={weight ?? ''}
            onChange={(e) => setWeight(e.target.value === '' ? null : Number(e.target.value))}
            type="number"
            step={0.1}
            min={0}
            placeholder={weightUnit === 'kg' ? '75.0' : '165.0'}
            className="field-input"
          />
        </div>

        <button type="submit" disabled={isSubmitting || !weight} className="btn-primary">
          {isSubmitting ? 'Saving...' : 'Log'}
        </button>
      </form>

      {submitError && <p className="field-error mt-2">{submitError}</p>}
    </div>
  )
}
