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
import { chartTheme } from '@/components/progress/chartTheme'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)


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
  const theme = chartTheme()
  const weightUnit = useSettingsStore((s) => s.weightUnit)

  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  const hasData = sortedLogs.length > 0

  return (
    <div className="card-pad">
      <h3 className="eyebrow mb-4">
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
                  borderColor: theme.line,
                  backgroundColor: theme.fill,
                  ...theme.point,
                  borderWidth: 2,
                  tension: theme.tension,
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
                  ...theme.tooltip,
                },
              },
              scales: {
                y: {
                  grid: theme.grid,
                  ticks: theme.ticks,
                },
                x: {
                  grid: { display: false },
                  ticks: theme.ticks,
                },
              },
            }}
          />
        </div>
      )}
    </div>
  )
}
