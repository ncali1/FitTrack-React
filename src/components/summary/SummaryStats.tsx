/**
 * Displays three stat cards: total assigned workouts, total completed, and the
 * completion percentage (colour-coded green/yellow/red by threshold).
 */
export function SummaryStats({ totalAssigned, totalCompleted }: { totalAssigned: number; totalCompleted: number }) {
  const completionPercentage = totalAssigned === 0 ? 0 : Math.round((totalCompleted / totalAssigned) * 100)

  const completionColor =
    completionPercentage >= 80 ? 'text-mark-500' : completionPercentage >= 50 ? 'text-amber-400' : 'text-red-400'
  const completionTile =
    completionPercentage >= 80 ? 'stat-tile-mark' : completionPercentage >= 50 ? 'stat-tile-accent' : 'stat-tile'

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="stat-tile">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Assigned</p>
        <p className="num text-3xl font-semibold text-ink mt-1">{totalAssigned}</p>
      </div>
      <div className="stat-tile-mark">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Completed</p>
        <p className="num text-3xl font-semibold text-mark-500 mt-1">{totalCompleted}</p>
      </div>
      <div className={`${completionTile}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Completion</p>
        <p className={`num text-3xl font-semibold mt-1 ${completionColor}`}>{completionPercentage}%</p>
      </div>
    </div>
  )
}
