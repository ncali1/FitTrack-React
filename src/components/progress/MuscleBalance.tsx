import { muscleGroupStyle } from '@/utils/muscleGroupStyles'
import type { MuscleGroupSets } from '@/utils/muscleBalance'

/**
 * Horizontal bar list of completed sets per muscle group over the active time range —
 * surfaces which muscle groups are getting trained and which are being neglected, using
 * the same per-group colors as exercise tags elsewhere in the app.
 */
export function MuscleBalance({ data }: { data: MuscleGroupSets[] }) {
  if (data.length === 0) {
    return (
      <div className="card-pad text-center py-8">
        <p className="text-ink-muted text-sm">No completed sets in this range yet.</p>
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.sets))

  return (
    <div className="card-pad space-y-3">
      {data.map(({ group, sets }) => (
        <div key={group} className="flex items-center gap-3">
          <span className={`text-xs font-medium w-20 flex-none truncate ${muscleGroupStyle(group).text}`}>
            {group}
          </span>
          <div className="flex-1 h-2 rounded-full bg-canvas-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${muscleGroupStyle(group).bar}`}
              style={{ width: `${(sets / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-ink-muted w-14 flex-none text-right">
            {sets} set{sets === 1 ? '' : 's'}
          </span>
        </div>
      ))}
    </div>
  )
}
