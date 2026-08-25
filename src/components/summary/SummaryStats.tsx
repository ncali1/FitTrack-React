/**
 * Displays three stat cards: total assigned workouts, total completed, and the
 * completion percentage (colour-coded green/yellow/red by threshold).
 */
export function SummaryStats({ totalAssigned, totalCompleted }: { totalAssigned: number; totalCompleted: number }) {
  const completionPercentage = totalAssigned === 0 ? 0 : Math.round((totalCompleted / totalAssigned) * 100)

  const completionColor =
    completionPercentage >= 80 ? 'text-lime-500' : completionPercentage >= 50 ? 'text-amber-400' : 'text-red-400'
  const completionTile =
    completionPercentage >= 80 ? 'stat-tile-lime' : completionPercentage >= 50 ? 'stat-tile-accent' : 'stat-tile'

  return (
    <div className="grid grid-cols-3 gap-3 stagger-children">
      <div className="stat-tile-violet animate-pop-in">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Assigned</p>
        <p className="text-3xl font-extrabold text-ink mt-1">{totalAssigned}</p>
      </div>
      <div className="stat-tile-lime animate-pop-in">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Completed</p>
        <p className="text-3xl font-extrabold text-lime-500 mt-1">{totalCompleted}</p>
      </div>
      <div className={`${completionTile} animate-pop-in`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Completion</p>
        <p className={`text-3xl font-extrabold mt-1 ${completionColor}`}>{completionPercentage}%</p>
      </div>
    </div>
  )
}
