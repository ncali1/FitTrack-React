import { useState } from 'react'
import type { ChangeEvent } from 'react'

interface TimeRange {
  start: string
  end: string
}

/** Formats a Date as a YYYY-MM-DD string. */
function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PRESETS: { label: string; days: number | null }[] = [
  { label: '4 Weeks', days: 28 },
  { label: '12 Weeks', days: 84 },
  { label: 'Custom', days: null },
]

/**
 * Provides quick-select preset buttons (4 Weeks, 12 Weeks) and a Custom mode with
 * explicit date inputs for choosing the progress graph time range.
 */
export function TimeRangeSelector({ value, onChange }: { value: TimeRange; onChange: (value: TimeRange) => void }) {
  const [activePreset, setActivePreset] = useState('4 Weeks')

  const selectPreset = (preset: { label: string; days: number | null }) => {
    setActivePreset(preset.label)
    if (preset.days !== null) {
      const today = new Date()
      const start = new Date(today)
      start.setDate(today.getDate() - preset.days)
      onChange({ start: toDateString(start), end: toDateString(today) })
    }
  }

  const handleStartChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ start: e.target.value, end: value.end })
  }

  const handleEndChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ start: value.start, end: e.target.value })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => selectPreset(preset)}
          className={
            activePreset === preset.label
              ? 'px-3 py-2 rounded-xl text-sm font-semibold transition-colors bg-accent-500 text-white'
              : 'px-3 py-2 rounded-xl text-sm font-semibold transition-colors bg-canvas-800 border border-surface-border text-ink-muted hover:border-ink-faint/50'
          }
        >
          {preset.label}
        </button>
      ))}

      {activePreset === 'Custom' && (
        <>
          <input
            type="date"
            value={value.start}
            onChange={handleStartChange}
            className="px-2.5 py-2 text-sm rounded-xl bg-canvas-800 border border-surface-border text-ink focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <span className="text-ink-faint text-sm">to</span>
          <input
            type="date"
            value={value.end}
            onChange={handleEndChange}
            className="px-2.5 py-2 text-sm rounded-xl bg-canvas-800 border border-surface-border text-ink focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </>
      )}
    </div>
  )
}
