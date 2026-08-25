import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Formats a YYYY-MM-DD date string as a short month + day label, e.g. "Jan 6". */
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, day!)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function todayString(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

/**
 * Navigation bar for stepping between calendar weeks. Displays the week's date range;
 * the "next" button is disabled when the current week is the present week.
 */
export function WeekNavigator({
  weekStart,
  weekEnd,
  onPrev,
  onNext,
}: {
  weekStart: string
  weekEnd: string
  onPrev: () => void
  onNext: () => void
}) {
  const today = todayString()
  const isCurrentWeek = today >= weekStart && today <= weekEnd

  return (
    <div className="flex items-center justify-between card-pad !py-3">
      <button onClick={onPrev} className="btn-icon" aria-label="Previous week">
        <ChevronLeft size={18} strokeWidth={2.5} />
      </button>

      <div className="text-center">
        <p className="text-sm font-semibold text-ink">
          {formatDate(weekStart)} – {formatDate(weekEnd)}
        </p>
        {isCurrentWeek && <p className="text-xs text-accent-400 font-semibold mt-0.5">This week</p>}
      </div>

      <button
        onClick={onNext}
        disabled={isCurrentWeek}
        className="btn-icon disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next week"
      >
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>
    </div>
  )
}
