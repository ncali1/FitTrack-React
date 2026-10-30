import { useState } from 'react'
import { useCardioStore } from '@/stores/cardio'
import { useSettingsStore } from '@/stores/settings'
import { addDays, getWeekStart } from '@/utils/calculations'
import { cardioTotals, formatDistance, formatTotalTime, sortCardioNewestFirst } from '@/utils/cardio'
import type { CardioSession } from '@/types'
import { CardioSessionRow } from './CardioDayCard'
import { CardioForm } from './CardioForm'

const RECENT_COUNT = 5

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Today", "Yesterday", or e.g. "Mon, Oct 19". */
function friendlyDate(dateStr: string, today: string): string {
  if (dateStr === today) return 'Today'
  if (dateStr === addDays(today, -1)) return 'Yesterday'
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Progress tab cardio overview: this week's session count, time, and distance next to
 * last week's, plus the most recent sessions (tap to edit).
 */
export function CardioSummary() {
  const sessions = useCardioStore((s) => s.sessions)
  const distanceUnit = useSettingsStore((s) => s.distanceUnit)
  const [editing, setEditing] = useState<CardioSession | null>(null)

  const today = todayString()
  const weekStart = getWeekStart(today)
  const thisWeek = cardioTotals(sessions, weekStart, addDays(weekStart, 6))
  const lastWeek = cardioTotals(sessions, addDays(weekStart, -7), addDays(weekStart, -1))
  const recent = sortCardioNewestFirst(sessions).slice(0, RECENT_COUNT)

  if (sessions.length === 0) {
    return (
      <div className="card-pad text-center py-10">
        <p className="text-ink font-semibold">No cardio logged yet</p>
        <p className="text-ink-muted text-sm mt-1">Log a run, ride, or any other session from Train.</p>
      </div>
    )
  }

  const stats = [
    { label: 'Sessions', value: String(thisWeek.sessions), previous: String(lastWeek.sessions) },
    { label: 'Time', value: formatTotalTime(thisWeek.durationSeconds), previous: formatTotalTime(lastWeek.durationSeconds) },
    {
      label: 'Distance',
      value: formatDistance(thisWeek.distanceKm, distanceUnit),
      previous: formatDistance(lastWeek.distanceKm, distanceUnit),
    },
  ]

  return (
    <div className="space-y-3">
      <div className="card p-3.5">
        <div className="text-xs text-ink-muted mb-2.5">This week</div>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} data-testid={`cardio-stat-${stat.label.toLowerCase()}`}>
              <div className="text-lg font-semibold text-ink whitespace-nowrap">{stat.value}</div>
              <div className="text-[11px] text-ink-muted">{stat.label}</div>
              <div className="text-[11px] text-ink-faint mt-0.5 whitespace-nowrap">Last week {stat.previous}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-3.5">
        <div className="text-xs text-ink-muted mb-2.5">Recent</div>
        <div className="divide-y divide-surface-border">
          {recent.map((session) => (
            <CardioSessionRow
              key={session.id}
              session={session}
              dateLabel={friendlyDate(session.date, today)}
              onClick={() => setEditing(session)}
            />
          ))}
        </div>
      </div>

      {editing && <CardioForm session={editing} defaultDate={editing.date} onClose={() => setEditing(null)} />}
    </div>
  )
}
