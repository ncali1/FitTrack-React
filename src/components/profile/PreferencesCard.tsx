import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useSettingsStore } from '@/stores/settings'

const REST_PRESETS = [30, 60, 90, 120, 180]
const MAX_REST_SECONDS = 900

const chipClass = (active: boolean, size: 'sm' | 'md' = 'sm') =>
  `${size === 'md' ? 'px-3' : 'px-2.5'} py-1 rounded-full text-xs font-semibold border ${
    active ? 'bg-accent text-canvas border-accent' : 'bg-transparent text-ink-muted border-surface-border'
  }`

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-sm text-ink">{label}</div>
        {hint && <div className="text-[11px] text-ink-muted mt-0.5">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex-none w-11 h-6 rounded-full p-0.5 transition-colors ${checked ? 'bg-accent' : 'bg-canvas-800'}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

/** Per-device workout preferences: units, rest timer length and alerts, screen wake lock, reminders. */
export function PreferencesCard() {
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const toggleWeightUnit = useSettingsStore((s) => s.toggleWeightUnit)
  const restDuration = useSettingsStore((s) => s.restDuration)
  const setRestDuration = useSettingsStore((s) => s.setRestDuration)
  const restTimerSound = useSettingsStore((s) => s.restTimerSound)
  const setRestTimerSound = useSettingsStore((s) => s.setRestTimerSound)
  const restTimerVibrate = useSettingsStore((s) => s.restTimerVibrate)
  const setRestTimerVibrate = useSettingsStore((s) => s.setRestTimerVibrate)
  const keepScreenAwake = useSettingsStore((s) => s.keepScreenAwake)
  const setKeepScreenAwake = useSettingsStore((s) => s.setKeepScreenAwake)
  const remindersEnabled = useSettingsStore((s) => s.remindersEnabled)
  const setRemindersEnabled = useSettingsStore((s) => s.setRemindersEnabled)

  const isCustomRest = !REST_PRESETS.includes(restDuration)
  const [editingCustomRest, setEditingCustomRest] = useState(false)
  const [customRestInput, setCustomRestInput] = useState('')

  const openCustomRest = () => {
    setCustomRestInput(String(restDuration))
    setEditingCustomRest(true)
  }

  const submitCustomRest = (e: FormEvent) => {
    e.preventDefault()
    const seconds = Math.round(Number(customRestInput))
    if (!Number.isFinite(seconds) || seconds < 5 || seconds > MAX_REST_SECONDS) return
    setRestDuration(seconds)
    setEditingCustomRest(false)
  }

  return (
    <div className="card p-3.5 divide-y divide-surface-border">
      <Row label="Units">
        <div className="flex gap-1.5">
          {(['kg', 'lb'] as const).map((unit) => (
            <button
              key={unit}
              onClick={() => weightUnit !== unit && toggleWeightUnit()}
              className={chipClass(weightUnit === unit, 'md')}
            >
              {unit}
            </button>
          ))}
        </div>
      </Row>

      <div className="py-2.5 space-y-2">
        <div className="space-y-2">
          <span className="block text-sm text-ink">Rest timer</span>
          <div className="flex flex-wrap gap-1.5">
            {REST_PRESETS.map((seconds) => (
              <button
                key={seconds}
                onClick={() => {
                  setRestDuration(seconds)
                  setEditingCustomRest(false)
                }}
                className={chipClass(restDuration === seconds)}
              >
                {seconds}s
              </button>
            ))}
            <button onClick={openCustomRest} className={chipClass(isCustomRest)} aria-label="Custom rest time">
              {isCustomRest ? `${restDuration}s` : 'Custom'}
            </button>
          </div>
        </div>

        {editingCustomRest && (
          <form onSubmit={submitCustomRest} className="flex gap-2">
            <input
              value={customRestInput}
              onChange={(e) => setCustomRestInput(e.target.value)}
              type="number"
              inputMode="numeric"
              min={5}
              max={MAX_REST_SECONDS}
              className="field-input flex-1"
              aria-label="Rest time in seconds"
              autoFocus
            />
            <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
              Set
            </button>
            <button type="button" onClick={() => setEditingCustomRest(false)} className="btn-ghost !px-3 !py-1.5 text-xs">
              Cancel
            </button>
          </form>
        )}
      </div>

      <Row label="Rest timer sound" hint="Play a tone when rest ends">
        <Switch label="Rest timer sound" checked={restTimerSound} onChange={setRestTimerSound} />
      </Row>

      <Row label="Rest timer vibration" hint="On devices that support it">
        <Switch label="Rest timer vibration" checked={restTimerVibrate} onChange={setRestTimerVibrate} />
      </Row>

      <Row label="Keep screen awake" hint="During a guided workout">
        <Switch label="Keep screen awake" checked={keepScreenAwake} onChange={setKeepScreenAwake} />
      </Row>

      <Row label="Notifications">
        <Switch label="Notifications" checked={remindersEnabled === true} onChange={setRemindersEnabled} />
      </Row>
    </div>
  )
}
