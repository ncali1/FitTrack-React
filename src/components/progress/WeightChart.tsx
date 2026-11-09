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
import { chartTheme } from './chartTheme'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)


interface WeeklyDataPoint {
  weekLabel: string
  averageWeight: number | null
}

/**
 * Renders a Chart.js line chart of average weight per week for the selected exercise,
 * displayed in the user's preferred unit (kg/lb). The underlying data is always
 * canonical kg — this component converts only for display. The chart is only shown
 * when at least one data point has a non-null weight; otherwise a placeholder is shown.
 */
export function WeightChart({ data, exerciseName }: { data: WeeklyDataPoint[]; exerciseName: string }) {
  const theme = chartTheme()
  const weightUnit = useSettingsStore((s) => s.weightUnit)

  const hasWeightData = data.length > 0 && data.some((d) => d.averageWeight !== null)

  return (
    <div className="card-pad">
      <h3 className="eyebrow mb-4">
        Weight Over Time ({weightUnit})
      </h3>
      {!hasWeightData ? (
        <div className="flex items-center justify-center py-12 text-ink-faint text-sm">No weight data available</div>
      ) : (
        <div className="relative h-64">
          <Line
            data={{
              labels: data.map((d) => d.weekLabel),
              datasets: [
                {
                  label: `${exerciseName} - Weight (${weightUnit})`,
                  data: data.map((d) => fromKg(d.averageWeight, weightUnit)),
                  borderColor: theme.line,
                  backgroundColor: theme.fill,
                  ...theme.point,
                  borderWidth: 2,
                  tension: theme.tension,
                  fill: true,
                  spanGaps: true,
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
                  beginAtZero: true,
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
