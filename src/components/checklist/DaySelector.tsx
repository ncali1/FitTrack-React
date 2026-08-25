import type { ChangeEvent } from 'react'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Formats a Date object as a YYYY-MM-DD string. */
function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayString(): string {
  return toDateString(new Date())
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
        <h2 className="text-ink text-lg">{formatSelectedDate(selectedDate)}</h2>
        {!isToday && (
          <button
            onClick={() => onSelectedDateChange(today)}
            className="text-sm text-accent-400 font-semibold hover:text-accent-400/80"
          >
            Today
          </button>
        )}
      </div>

      {/* Day navigation buttons */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {recentDays().map((day) => (
          <button
            key={day.dateString}
            onClick={() => onSelectedDateChange(day.dateString)}
            className={
              day.dateString === selectedDate
                ? 'flex-shrink-0 flex flex-col items-center px-3.5 py-2.5 rounded-xl border transition-colors bg-accent-500 border-accent-500 text-white shadow-[0_4px_16px_-4px_rgba(255,90,43,0.6)]'
                : 'flex-shrink-0 flex flex-col items-center px-3.5 py-2.5 rounded-xl border transition-colors bg-surface border-surface-border text-ink-muted hover:border-ink-faint/50'
            }
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{day.dayLabel}</span>
            <span className="text-lg font-bold leading-tight">{day.dayNumber}</span>
          </button>
        ))}
      </div>

      {/* Custom date picker */}
      <div className="flex items-center gap-2">
        <label htmlFor="date-picker" className="text-xs text-ink-muted">
          Or pick a date:
        </label>
        <input
          id="date-picker"
          type="date"
          value={selectedDate}
          max={today}
          onChange={handleDateInputChange}
          className="px-2.5 py-1.5 text-sm rounded-lg bg-canvas-800 border border-surface-border text-ink focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
      </div>
    </div>
  )
}
