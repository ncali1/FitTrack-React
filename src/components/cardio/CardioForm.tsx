import { useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { X, Trash2 } from 'lucide-react'
import { useCardioStore } from '@/stores/cardio'
import { useSettingsStore } from '@/stores/settings'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { CARDIO_TYPES, CARDIO_TYPE_ORDER, distanceToKm, formatPace, kmToDistance } from '@/utils/cardio'
import type { CardioSession, CardioType } from '@/types'

const MAX_DURATION_SECONDS = 24 * 3600

/** A number input's value as a number, or undefined while it's empty. */
const parse = (value: string): number | undefined => (value.trim() === '' ? undefined : Number(value))

/**
 * Modal for logging a cardio session, or editing / deleting an existing one. Distance is
 * entered in the user's distance unit and stored in km; pace or speed is previewed live.
 */
export function CardioForm({
  session,
  defaultDate,
  onClose,
}: {
  /** The session to edit; omitted to log a new one. */
  session?: CardioSession
  defaultDate: string
  onClose: () => void
}) {
  useBodyScrollLock()
  const saveSession = useCardioStore((s) => s.saveSession)
  const deleteSession = useCardioStore((s) => s.deleteSession)
  const distanceUnit = useSettingsStore((s) => s.distanceUnit)

  const [type, setType] = useState<CardioType>(session?.type ?? 'run')
  const [date, setDate] = useState(session?.date ?? defaultDate)
  const [minutes, setMinutes] = useState(session ? String(Math.floor(session.durationSeconds / 60)) : '')
  const [seconds, setSeconds] = useState(session ? String(session.durationSeconds % 60) : '')
  const [distance, setDistance] = useState(
    session?.distanceKm ? String(Math.round(kmToDistance(session.distanceKm, distanceUnit) * 100) / 100) : ''
  )
  const [heartRate, setHeartRate] = useState(session?.avgHeartRate ? String(session.avgHeartRate) : '')
  const [calories, setCalories] = useState(session?.calories ? String(session.calories) : '')
  const [notes, setNotes] = useState(session?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const durationSeconds = (parse(minutes) ?? 0) * 60 + (parse(seconds) ?? 0)
  const distanceValue = parse(distance)
  const distanceKm = distanceValue ? distanceToKm(distanceValue, distanceUnit) : undefined
  const pace = formatPace({ type, durationSeconds, distanceKm }, distanceUnit)

  const validate = (): string | null => {
    if (!date) return 'Pick a date.'
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 'Enter how long it took.'
    if (durationSeconds > MAX_DURATION_SECONDS) return 'Duration must be under 24 hours.'
    if ((parse(seconds) ?? 0) >= 60) return 'Seconds must be under 60.'
    if (distanceValue !== undefined && (!(distanceValue >= 0) || distanceValue > 1000)) return 'Enter a realistic distance.'
    const hr = parse(heartRate)
    if (hr !== undefined && !(hr >= 30 && hr <= 250)) return 'Heart rate must be between 30 and 250 bpm.'
    const kcal = parse(calories)
    if (kcal !== undefined && !(kcal >= 0 && kcal <= 10000)) return 'Enter a realistic calorie count.'
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    try {
      await saveSession(
        {
          date,
          type,
          durationSeconds,
          distanceKm,
          avgHeartRate: parse(heartRate),
          calories: parse(calories),
          notes,
        },
        session?.id
      )
      onClose()
    } catch (err) {
      console.error('Failed to save cardio session:', err)
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!session || !confirm('Delete this cardio session?')) return
    try {
      await deleteSession(session.id)
      onClose()
    } catch (err) {
      console.error('Failed to delete cardio session:', err)
      setError('Failed to delete. Please try again.')
    }
  }

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-panel" role="dialog" aria-label={session ? 'Edit cardio' : 'Log cardio'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
          <div className="section-header">
            <h2 className="text-ink">{session ? 'Edit cardio' : 'Log cardio'}</h2>
            <button type="button" onClick={onClose} className="btn-icon" aria-label="Close">
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div>
            <span className="field-label">Type</span>
            <div className="flex flex-wrap gap-1.5">
              {CARDIO_TYPE_ORDER.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setType(option)}
                  aria-pressed={type === option}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    type === option
                      ? 'bg-accent text-canvas border-accent'
                      : 'bg-transparent text-ink-muted border-surface-border'
                  }`}
                >
                  {CARDIO_TYPES[option].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="cardio-date" className="field-label">
              Date
            </label>
            <input id="cardio-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input" />
          </div>

          <div>
            <span className="field-label">Duration</span>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="Minutes"
                aria-label="Minutes"
                className="field-input"
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                placeholder="Seconds"
                aria-label="Seconds"
                className="field-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cardio-distance" className="field-label">
                Distance ({distanceUnit})
              </label>
              <input
                id="cardio-distance"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="Optional"
                className="field-input"
              />
            </div>
            <div>
              <span className="field-label">{CARDIO_TYPES[type].measure === 'speed' ? 'Speed' : 'Pace'}</span>
              <div className="field-input !bg-transparent text-ink-muted" aria-live="polite" data-testid="cardio-pace">
                {pace ?? '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cardio-hr" className="field-label">
                Avg heart rate
              </label>
              <input
                id="cardio-hr"
                type="number"
                inputMode="numeric"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                placeholder="bpm"
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="cardio-calories" className="field-label">
                Calories
              </label>
              <input
                id="cardio-calories"
                type="number"
                inputMode="numeric"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="kcal"
                className="field-input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cardio-notes" className="field-label">
              Notes
            </label>
            <textarea
              id="cardio-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional"
              className="field-input resize-none"
            />
          </div>

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            {session && (
              <button type="button" onClick={handleDelete} className="btn-danger" aria-label="Delete cardio session">
                <Trash2 size={16} strokeWidth={2} />
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
