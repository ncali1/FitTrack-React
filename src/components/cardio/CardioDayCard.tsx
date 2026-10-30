import { useState } from 'react'
import { HeartPulse, Plus } from 'lucide-react'
import { useCardioStore } from '@/stores/cardio'
import { useSettingsStore } from '@/stores/settings'
import { CARDIO_TYPES, formatDistance, formatDuration, formatPace } from '@/utils/cardio'
import type { CardioSession } from '@/types'
import { CardioForm } from './CardioForm'

/** One cardio session as a tappable summary row, optionally labelled with its date. */
export function CardioSessionRow({
  session,
  dateLabel,
  onClick,
}: {
  session: CardioSession
  dateLabel?: string
  onClick: () => void
}) {
  const distanceUnit = useSettingsStore((s) => s.distanceUnit)
  const pace = formatPace(session, distanceUnit)
  const details = [
    formatDuration(session.durationSeconds),
    session.distanceKm ? formatDistance(session.distanceKm, distanceUnit) : null,
    pace,
  ].filter(Boolean)

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 text-left"
      aria-label={`Edit ${CARDIO_TYPES[session.type].label} cardio`}
    >
      <div className="w-[34px] h-[34px] rounded-[10px] bg-red-500/15 flex items-center justify-center flex-none">
        <HeartPulse size={16} strokeWidth={2} className="text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink">{CARDIO_TYPES[session.type].label}</div>
        <div className="text-xs text-ink-muted truncate">{details.join(' · ')}</div>
      </div>
      {(dateLabel || session.avgHeartRate) && (
        <div className="text-right flex-none">
          {dateLabel && <div className="text-xs text-ink-muted">{dateLabel}</div>}
          {session.avgHeartRate && <div className="text-xs text-ink-faint">{session.avgHeartRate} bpm</div>}
        </div>
      )}
    </button>
  )
}

/**
 * The Train tab's cardio section for the selected date: the sessions logged that day
 * (tap one to edit it) and a button to log another.
 */
export function CardioDayCard({ date }: { date: string }) {
  const sessions = useCardioStore((s) => s.sessions)
  const daySessions = sessions.filter((s) => s.date === date).sort((a, b) => a.createdAt - b.createdAt)

  /** `'new'` while logging, a session while editing it, else null. */
  const [editing, setEditing] = useState<CardioSession | 'new' | null>(null)

  return (
    <div className="card-pad space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-ink text-sm">Cardio</h3>
        <button onClick={() => setEditing('new')} className="btn-ghost !px-2.5 !py-1 text-xs">
          <Plus size={14} strokeWidth={2.5} />
          Log cardio
        </button>
      </div>

      {daySessions.length === 0 ? (
        <p className="text-xs text-ink-faint">No cardio logged for this day.</p>
      ) : (
        <div className="divide-y divide-surface-border">
          {daySessions.map((session) => (
            <CardioSessionRow key={session.id} session={session} onClick={() => setEditing(session)} />
          ))}
        </div>
      )}

      {editing && (
        <CardioForm
          session={editing === 'new' ? undefined : editing}
          defaultDate={date}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
