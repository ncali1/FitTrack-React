import { Bar } from 'react-chartjs-2'
import { Chart, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend)

const GRID_COLOR = 'rgba(245, 246, 248, 0.06)'
const TICK_COLOR = '#9a9ea9'

interface WeeklyDataPoint {
  weekLabel: string
  completionRate: number
}

/** Renders a Chart.js bar chart of weekly completion rate percentages (0-100). */
export function CompletionRateChart({ data }: { data: WeeklyDataPoint[] }) {
  return (
    <div className="card-pad">
      <h3 className="mb-4 text-sm font-semibold text-ink-muted uppercase tracking-wide">Weekly Completion Rate</h3>
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
                  backgroundColor: 'rgba(255, 90, 43, 0.55)',
                  borderColor: '#ff5a2b',
                  borderWidth: 1.5,
                  borderRadius: 6,
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
                  max: 100,
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
