/**
 * Pure rules for nudging someone to export a backup. No store dependencies — takes data
 * as parameters, like reminders.ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** How long a device can go without an export before the reminder appears. */
export const BACKUP_REMINDER_DAYS = 30
/** How long "Later" hides the reminder for. */
export const BACKUP_SNOOZE_DAYS = 7

/** The timestamps every stored record carries. */
interface Timestamped {
  createdAt: number
  updatedAt: number
}

interface BackupReminderInput {
  /** The user's logged history (sessions, cardio, body weight). */
  records: Timestamped[]
  /** Signed-in users already have a copy in the cloud. */
  signedIn: boolean
  /** When a backup was last exported or restored on this device; `null` if never. */
  lastBackupAt: number | null
  /** When the reminder was last put off; `null` if never. */
  snoozedAt: number | null
  now: number
}

/**
 * `true` when the only copy of someone's history is on this device and it has gone 30
 * days without an export. Counted from the last backup, or from the oldest record when
 * there has never been one — so a new user isn't nagged in their first month. Stays quiet
 * when nothing has changed since the last backup, since that file is still complete.
 */
export function shouldRemindToBackUp({ records, signedIn, lastBackupAt, snoozedAt, now }: BackupReminderInput): boolean {
  if (signedIn || records.length === 0) return false

  if (lastBackupAt !== null) {
    const newestChange = Math.max(...records.map((r) => r.updatedAt))
    if (newestChange <= lastBackupAt) return false
  }

  const countFrom = lastBackupAt ?? Math.min(...records.map((r) => r.createdAt))
  if (now - countFrom < BACKUP_REMINDER_DAYS * DAY_MS) return false

  return snoozedAt === null || now - snoozedAt >= BACKUP_SNOOZE_DAYS * DAY_MS
}

/** "Never", "Today", "Yesterday" or "12 days ago" — when the last backup was made. */
export function describeLastBackup(lastBackupAt: number | null, now: number): string {
  if (lastBackupAt === null) return 'Never'
  const days = Math.floor(Math.max(0, now - lastBackupAt) / DAY_MS)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}
