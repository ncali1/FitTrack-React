import type { ChangeEvent } from 'react'
import { todayString } from '@/utils/calculations'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Formats a Date object as a YYYY-MM-DD string. */
function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Last 7 days including today, displayed oldest-first (left to right). */
function recentDays() {
  const days: { dateString: string; dayLabel: string; dayNumber: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({
      dateString: toDateString(d),
      dayLabel: DAY_LABELS[d.getDay()]!,
      dayNumber: d.getDate(),
    })
  }
  return days
}

/** Full formatted display label for the selected date (e.g. "Monday, Jan 6, 2025"). */
function formatSelectedDate(selectedDate: string): string {
  const [year, month, day] = selectedDate.split('-').map(Number)
  const d = new Date(year!, month! - 1, day!)
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]
  return `${dayName}, ${MONTH_LABELS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/**
 * Provides date-selection UI for the Daily Checklist. Renders a row of the last 7 days
 * as quick-select buttons, a "Go to Today" shortcut, and a native date-picker for
 * arbitrary past dates.
 */
export function DaySelector({
  selectedDate,
  onSelectedDateChange,
}: {
  selectedDate: string
  onSelectedDateChange: (date: string) => void
}) {
  const today = todayString()
  const isToday = selectedDate === today

  const handleDateInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) onSelectedDateChange(e.target.value)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Date display */}
      <div className="flex items-center justify-between">
        <h1 className="text-ink">{formatSelectedDate(selectedDate)}</h1>
        {!isToday && (
          <button
            onClick={() => onSelectedDateChange(today)}
            className="btn-ghost !min-h-9 !py-1.5 !px-2 text-accent-400"
          >
            Today
          </button>
        )}
      </div>

      {/* Day navigation buttons */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {recentDays().map((day) => (
          <button
            key={day.dateString}
            onClick={() => onSelectedDateChange(day.dateString)}
            className={
              day.dateString === selectedDate
                ? 'flex-1 min-w-11 flex flex-col items-center py-2 rounded-sm border transition-colors bg-accent-500 border-accent-500 text-canvas-950'
                : 'flex-1 min-w-11 flex flex-col items-center py-2 rounded-sm border transition-colors border-surface-border text-ink-muted hover:border-ink-faint'
            }
          >
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em]">{day.dayLabel}</span>
            <span className="num text-lg font-semibold leading-tight">{day.dayNumber}</span>
          </button>
        ))}
      </div>

      {/* Custom date picker */}
      <div className="flex items-center gap-2">
        <label htmlFor="date-picker" className="eyebrow">
          Or pick a date:
        </label>
        <input
          id="date-picker"
          type="date"
          value={selectedDate}
          max={today}
          onChange={handleDateInputChange}
          className="px-2.5 py-1.5 text-sm font-mono rounded-sm bg-canvas-800 border border-surface-border text-ink focus:outline-none focus:border-accent-500"
        />
      </div>
    </div>
  )
}
