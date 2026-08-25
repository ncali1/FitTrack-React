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

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const GRID_COLOR = 'rgba(245, 246, 248, 0.06)'
const TICK_COLOR = '#9a9ea9'

interface WeeklyDataPoint {
  weekLabel: string
  averageReps: number
}

/** Renders a Chart.js line chart of average reps per week for the selected exercise. */
export function RepsChart({ data, exerciseName }: { data: WeeklyDataPoint[]; exerciseName: string }) {
  return (
    <div className="card-pad">
      <h3 className="mb-4 text-sm font-semibold text-ink-muted uppercase tracking-wide">Reps Over Time</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-ink-faint text-sm">No data available</div>
      ) : (
        <div className="relative h-64">
          <Line
            data={{
              labels: data.map((d) => d.weekLabel),
              datasets: [
                {
                  label: `${exerciseName} - Reps`,
                  data: data.map((d) => d.averageReps),
                  borderColor: '#ff5a2b',
                  backgroundColor: 'rgba(255, 90, 43, 0.15)',
                  pointBackgroundColor: '#ff5a2b',
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
