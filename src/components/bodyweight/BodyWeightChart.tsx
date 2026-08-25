import { Line } from 'react-chartjs-2'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { useSettingsStore } from '@/stores/settings'
import { fromKg } from '@/utils/units'
import type { BodyWeightLog } from '@/types'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const GRID_COLOR = 'rgba(245, 246, 248, 0.06)'
const TICK_COLOR = '#9a9ea9'

/** Formats a YYYY-MM-DD string as a short month + day label, e.g. "Jan 6". */
function formatLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year!, month! - 1, day!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Renders a Chart.js line chart of every logged body weight entry, in chronological
 * order, displayed in the user's preferred unit (kg/lb). Unlike WeightChart (which
 * shows weekly-aggregated exercise performance), this plots raw log entries with no
 * bucketing.
 */
export function BodyWeightChart({ logs }: { logs: BodyWeightLog[] }) {
  const weightUnit = useSettingsStore((s) => s.weightUnit)

  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  const hasData = sortedLogs.length > 0

  return (
    <div className="card-pad">
      <h3 className="mb-4 text-sm font-semibold text-ink-muted uppercase tracking-wide">
        Body Weight Over Time ({weightUnit})
      </h3>
      {!hasData ? (
        <div className="flex items-center justify-center py-12 text-ink-faint text-sm">No body weight logged yet</div>
      ) : (
        <div className="relative h-64">
          <Line
            data={{
              labels: sortedLogs.map((l) => formatLabel(l.date)),
              datasets: [
                {
                  label: `Body Weight (${weightUnit})`,
                  data: sortedLogs.map((l) => fromKg(l.weightKg, weightUnit)),
                  borderColor: '#c6ff5e',
                  backgroundColor: 'rgba(198, 255, 94, 0.12)',
                  pointBackgroundColor: '#c6ff5e',
                  pointBorderColor: '#0a0b0f',
                  pointRadius: 4,
                  pointHoverRadius: 6,
                  borderWidth: 2.5,
                  tension: 0.35,
                  fill: true,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  enabled: true,
                  backgroundColor: '#1c1e28',
                  titleColor: '#f5f6f8',
                  bodyColor: '#f5f6f8',
                  borderColor: '#262835',
                  borderWidth: 1,
                  padding: 10,
                  cornerRadius: 8,
                },
              },
              scales: {
                y: {
                  grid: { color: GRID_COLOR },
                  ticks: { color: TICK_COLOR },
                },
                x: {
                  grid: { display: false },
                  ticks: { color: TICK_COLOR },
                },
              },
            }}
          />
        </div>
      )}
    </div>
  )
}
