import { Bar } from 'react-chartjs-2'
import { Chart, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { chartTheme } from './chartTheme'

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend)


interface WeeklyDataPoint {
  weekLabel: string
  completionRate: number
}

/** Renders a Chart.js bar chart of weekly completion rate percentages (0-100). */
export function CompletionRateChart({ data }: { data: WeeklyDataPoint[] }) {
  const theme = chartTheme()
  return (
    <div className="card-pad">
      <h3 className="eyebrow mb-4">Weekly Completion Rate</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-ink-faint text-sm">No data available</div>
      ) : (
        <div className="relative h-64">
          <Bar
            data={{
              labels: data.map((d) => d.weekLabel),
              datasets: [
                {
                  label: 'Completion Rate (%)',
                  data: data.map((d) => d.completionRate),
                  backgroundColor: theme.bar,
                  borderWidth: 0,
                  borderRadius: 0,
                  maxBarThickness: 36,
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
                  max: 100,
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
