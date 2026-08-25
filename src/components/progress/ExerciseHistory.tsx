import { useMemo } from 'react'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useSettingsStore } from '@/stores/settings'
import { calculatePersonalRecord } from '@/utils/personalRecords'
import { formatWeight } from '@/utils/units'

const DIFFICULTY_BADGE: Record<string, string> = {
  easy: 'badge-lime',
  moderate: 'badge-warn',
  hard: 'badge-danger',
}

/** Formats a YYYY-MM-DD string as a short readable date, e.g. "Jan 6, 2026". */
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, day!)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Displays every logged instance of one exercise, newest first — date, sets, reps,
 * weight, and difficulty — as a raw chronological list rather than the aggregated
 * weekly charts shown elsewhere in Progress. Rows that match the exercise's all-time
 * personal record are flagged with a PR badge.
 */
export function ExerciseHistory({ exerciseId }: { exerciseId: string }) {
  const weightUnit = useSettingsStore((s) => s.weightUnit)

  // getCachedExerciseHistory is memoized (same reference on a cache hit), so it's safe
  // to call inside the selector directly. calculatePersonalRecord is NOT memoized — it
  // builds a fresh object every call — so calling *that* inside a selector would make
  // useSyncExternalStore see a "changed" value on every read and loop forever. Derive it
  // from the raw `sessions` array instead, as an ordinary memoized render-body value.
  const history = useWorkoutSessionsStore((s) => s.getCachedExerciseHistory(exerciseId))
  const sessions = useWorkoutSessionsStore((s) => s.sessions)
  const record = useMemo(() => {
    const performances = sessions.flatMap((s) => s.exercises).filter((e) => e.exerciseId === exerciseId)
    return calculatePersonalRecord(performances)
  }, [sessions, exerciseId])

  const isPersonalRecord = (entry: { weight?: number; actualReps?: number }): boolean => {
    const isWeightPR = entry.weight !== undefined && entry.weight === record.maxWeight
    const isRepsPR = entry.actualReps !== undefined && entry.actualReps === record.maxReps
    return isWeightPR || isRepsPR
  }

  return (
    <div className="card-pad">
      <h3 className="mb-4 text-sm font-semibold text-ink-muted uppercase tracking-wide">History</h3>

      {history.length === 0 ? (
        <div className="text-center py-10">
          <div className="empty-blob !w-16 !h-16 !text-3xl animate-float">📋</div>
          <p className="text-ink-faint text-sm">No history logged yet for this exercise.</p>
        </div>
      ) : (
        <ul className="divide-y divide-surface-border">
          {history.map((entry, i) => (
            <li key={`${entry.date}-${i}`} className="py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-32">
                <p className="text-sm font-semibold text-ink">{formatDate(entry.date)}</p>
                {!entry.completed && <p className="text-xs text-ink-faint mt-0.5">Not completed</p>}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {entry.actualSets != null && entry.actualReps != null && (
                  <span className="badge-muted">
                    {entry.actualSets} × {entry.actualReps}
                  </span>
                )}
                {entry.weight != null && (
                  <span className="badge-muted">
                    {formatWeight(entry.weight, weightUnit)}{weightUnit}
                  </span>
                )}
                {entry.difficultyLevel && (
                  <span className={DIFFICULTY_BADGE[entry.difficultyLevel]}>{entry.difficultyLevel}</span>
                )}
                {isPersonalRecord(entry) && <span className="badge-accent">🏆 PR</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
