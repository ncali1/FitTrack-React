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

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const GRID_COLOR = 'rgba(245, 246, 248, 0.06)'
const TICK_COLOR = '#9a9ea9'

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
  const weightUnit = useSettingsStore((s) => s.weightUnit)

  const hasWeightData = data.length > 0 && data.some((d) => d.averageWeight !== null)

  return (
    <div className="card-pad">
      <h3 className="mb-4 text-sm font-semibold text-ink-muted uppercase tracking-wide">
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
                  borderColor: '#c6ff5e',
                  backgroundColor: 'rgba(198, 255, 94, 0.12)',
                  pointBackgroundColor: '#c6ff5e',
                  pointBorderColor: '#0a0b0f',
                  pointRadius: 4,
                  pointHoverRadius: 6,
                  borderWidth: 2.5,
                  tension: 0.35,
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
                  beginAtZero: true,
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
