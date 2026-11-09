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
import { chartTheme } from './chartTheme'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)


interface WeeklyDataPoint {
  weekLabel: string
  averageReps: number
}

/** Renders a Chart.js line chart of average reps per week for the selected exercise. */
export function RepsChart({ data, exerciseName }: { data: WeeklyDataPoint[]; exerciseName: string }) {
  const theme = chartTheme()
  return (
    <div className="card-pad">
      <h3 className="eyebrow mb-4">Reps Over Time</h3>
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
