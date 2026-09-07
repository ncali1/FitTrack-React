const DAYS = [
  { key: 'monday', short: 'Mon' },
  { key: 'tuesday', short: 'Tue' },
  { key: 'wednesday', short: 'Wed' },
  { key: 'thursday', short: 'Thu' },
  { key: 'friday', short: 'Fri' },
  { key: 'saturday', short: 'Sat' },
  { key: 'sunday', short: 'Sun' },
]

type Breakdown = Record<string, { assigned: number; completed: number }>

/**
 * Compact 7-bar view of the current week's completion — bar height reflects percent
 * completed for that day, rest days (nothing assigned) render as a flat muted tick
 * rather than an empty bar, and today is highlighted in the accent color.
 */
export function WeeklyBars({ breakdown, today }: { breakdown: Breakdown; today: string }) {
  return (
    <div className="card flex flex-row items-end justify-between gap-1.5 px-3 py-4 h-[120px]">
      {DAYS.map((day) => {
        const data = breakdown[day.key]
        const isRestDay = !data || data.assigned === 0
        const isToday = day.key === today
        const pct = data && data.assigned > 0 ? (data.completed / data.assigned) * 100 : 0
        const heightPx = isRestDay ? 4 : Math.max(6, Math.round(pct * 0.7))

        return (
          <div key={day.key} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5">
            <div
              className={`w-full max-w-[22px] rounded ${isRestDay ? 'bg-canvas-800' : isToday ? 'bg-accent' : 'bg-accent-700'}`}
              style={{ height: `${heightPx}px` }}
              title={data ? `${data.completed} of ${data.assigned} completed` : 'Rest day'}
            />
            <div className={`text-[10px] ${isToday ? 'text-accent-400' : 'text-ink-muted'}`}>{day.short}</div>
          </div>
        )
      })}
    </div>
  )
}
