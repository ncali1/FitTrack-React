const DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
]

type Breakdown = Record<string, { assigned: number; completed: number }>

/** Status icon: ✓ fully complete, · partially complete, × none complete, — no workouts. */
function statusIcon(breakdown: Breakdown, day: string): string {
  const data = breakdown[day]
  if (!data || data.assigned === 0) return '—'
  if (data.completed === data.assigned) return '✓'
  if (data.completed > 0) return '·'
  return '×'
}

function statusClass(breakdown: Breakdown, day: string): string {
  const data = breakdown[day]
  if (!data || data.assigned === 0) return 'bg-surface-hover text-ink-faint'
  if (data.completed === data.assigned) return 'bg-lime-500 text-base-900 font-bold'
  if (data.completed > 0) return 'bg-amber-500/20 text-amber-400 font-bold'
  return 'bg-red-500/15 text-red-400 font-bold'
}

function statusTitle(breakdown: Breakdown, day: string): string {
  const data = breakdown[day]
  if (!data || data.assigned === 0) return 'No workouts assigned'
  return `${data.completed} of ${data.assigned} completed`
}

/** Shows a 7-column grid (Mon–Sun) with a status icon and "completed/assigned" count for each day. */
export function DayBreakdown({ breakdown }: { breakdown: Breakdown }) {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-surface-border overflow-x-auto">
        {DAYS.map((day) => (
          <div key={day.key} className="flex flex-col items-center py-4 px-1">
            <span className="text-[10px] font-semibold text-ink-faint uppercase mb-2 tracking-wide">{day.label}</span>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${statusClass(breakdown, day.key)}`}
                title={statusTitle(breakdown, day.key)}
              >
                {statusIcon(breakdown, day.key)}
              </span>
              <span className="text-[10px] text-ink-muted">
                {breakdown[day.key]?.completed ?? 0}/{breakdown[day.key]?.assigned ?? 0}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
