import { useMemo } from 'react'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useActiveProgram } from '@/hooks/useActiveProgram'
import { calculateStreak } from '@/utils/calculations'
import { countPersonalRecords } from '@/utils/personalRecords'

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Three lifetime totals under the profile header: workouts logged, current streak, records set. */
export function ProfileStats() {
  const sessions = useWorkoutSessionsStore((s) => s.sessions)
  const activeProgram = useActiveProgram()

  const workouts = sessions.filter((s) => s.exercises.some((e) => e.completed)).length
  const streak = calculateStreak(activeProgram, sessions, todayString())
  const records = useMemo(() => countPersonalRecords(sessions), [sessions])

  const stats = [
    { label: 'Workouts', value: workouts },
    { label: 'Day streak', value: streak },
    { label: 'Records set', value: records },
  ]

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {stats.map((stat) => (
        <div key={stat.label} className="card p-3 text-center">
          <div className="text-xl font-semibold text-ink">{stat.value}</div>
          <div className="text-[11px] text-ink-muted mt-0.5">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
