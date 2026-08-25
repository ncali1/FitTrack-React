import { useEffect, useState, lazy, Suspense } from 'react'
import { Trash2 } from 'lucide-react'
import { useBodyWeightStore } from '@/stores/bodyWeight'
import { useSettingsStore } from '@/stores/settings'
import { formatWeight } from '@/utils/units'
import { BodyWeightLogForm } from './BodyWeightLogForm'

// Lazy-loaded — pulls in Chart.js, only needed once this tab is visited.
const BodyWeightChart = lazy(() =>
  import('./BodyWeightChart').then((m) => ({ default: m.BodyWeightChart }))
)

/** Formats a YYYY-MM-DD string as a short readable date, e.g. "Jan 6, 2026". */
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, day!)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Composition-root page for the Body Weight tab. Composes a log-entry form, a
 * chronological chart, and a deletable log list — separate from workout performance
 * data.
 */
export function BodyWeightTracker() {
  const logs = useBodyWeightStore((s) => s.logs)
  const loading = useBodyWeightStore((s) => s.loading)
  const loadLogs = useBodyWeightStore((s) => s.loadLogs)
  const deleteLog = useBodyWeightStore((s) => s.deleteLog)
  const weightUnit = useSettingsStore((s) => s.weightUnit)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadLogs().catch((err) => {
      console.error('Failed to load body weight logs:', err)
      setError('Failed to load body weight logs. Please refresh the page.')
    })
  }, [loadLogs])

  /** Logged entries, newest first, for the log list (chart shows them oldest-first). */
  const recentLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date))

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return
    try {
      await deleteLog(id)
    } catch (err) {
      console.error('Failed to delete body weight log:', err)
      setError('Failed to delete entry. Please try again.')
    }
  }

  return (
    <div className="space-y-5">
      <div className="section-header">
        <div>
          <h2 className="text-ink">Body Weight</h2>
          <p className="text-ink-muted text-sm mt-0.5">{logs.length} entries logged</p>
        </div>
      </div>

      {error && (
        <div className="alert-error">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 ml-2 text-lg leading-none"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      <BodyWeightLogForm />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-surface-border border-t-accent-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <Suspense fallback={<div className="card-pad text-center py-14 text-ink-faint">Loading chart…</div>}>
            <BodyWeightChart logs={logs} />
          </Suspense>

          <div className="card-pad">
            <h3 className="mb-4 text-sm font-semibold text-ink-muted uppercase tracking-wide">Log</h3>

            {recentLogs.length === 0 ? (
              <div className="text-center py-10">
                <div className="empty-blob !w-16 !h-16 !text-3xl animate-float">⚖️</div>
                <p className="text-ink-faint text-sm">No entries yet — log your weight above.</p>
              </div>
            ) : (
              <ul className="divide-y divide-surface-border">
                {recentLogs.map((log) => (
                  <li key={log.id} className="py-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{formatDate(log.date)}</p>
                    <div className="flex items-center gap-3">
                      <span className="badge-muted">
                        {formatWeight(log.weightKg, weightUnit)}{weightUnit}
                      </span>
                      <button onClick={() => handleDelete(log.id)} className="btn-icon !w-8 !h-8" aria-label="Delete entry">
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
