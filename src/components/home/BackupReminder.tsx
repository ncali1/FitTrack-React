import { useState } from 'react'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useCardioStore } from '@/stores/cardio'
import { useBodyWeightStore } from '@/stores/bodyWeight'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { useBackupExport } from '@/hooks/useBackupExport'
import { shouldRemindToBackUp, describeLastBackup } from '@/utils/backupReminder'

/**
 * A notice on Home asking someone to export a backup when this device holds the only
 * copy of their history and it hasn't been exported for a month. Without an account
 * nothing else protects that data from a lost phone or cleared browser storage.
 *
 * Sits in the page rather than floating over it like the workout reminder: it isn't
 * urgent, and it must never get in the way of starting a session. Exporting or tapping
 * "Later" hides it; the rules for when it returns live in `utils/backupReminder`.
 */
export function BackupReminder() {
  const sessions = useWorkoutSessionsStore((s) => s.sessions)
  const cardioSessions = useCardioStore((s) => s.sessions)
  const bodyWeightLogs = useBodyWeightStore((s) => s.logs)
  const signedIn = useAuthStore((s) => s.user !== null)
  const lastBackupAt = useSettingsStore((s) => s.lastBackupAt)
  const snoozedAt = useSettingsStore((s) => s.backupReminderSnoozedAt)
  const snooze = useSettingsStore((s) => s.snoozeBackupReminder)
  const exportBackup = useBackupExport()

  // Read once on mount rather than on every render, which must stay pure. Day-level
  // precision is all the rules need, and Home remounts on every tab switch.
  const [now] = useState(() => Date.now())
  const due = shouldRemindToBackUp({
    records: [...sessions, ...cardioSessions, ...bodyWeightLogs],
    signedIn,
    lastBackupAt,
    snoozedAt,
    now,
  })
  if (!due) return null

  return (
    <section
      aria-labelledby="backup-reminder-heading"
      className="border border-surface-border border-l-4 border-l-accent-500 rounded-sm p-4"
    >
      <h2 id="backup-reminder-heading" className="text-base">
        Back up your log
      </h2>
      <p className="text-sm text-ink-muted mt-1.5">
        Your training history is stored only on this device. Export a copy so a lost phone or cleared browser data
        doesn’t take it with it.
      </p>
      <p className="eyebrow mt-2">Last backup · {describeLastBackup(lastBackupAt, now)}</p>
      <div className="flex gap-2 mt-3">
        <button onClick={exportBackup} className="btn-secondary flex-1">
          Export backup
        </button>
        <button onClick={snooze} className="btn-ghost flex-1">
          Later
        </button>
      </div>
    </section>
  )
}
