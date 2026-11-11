/**
 * Unit tests for the backup reminder rules: who is reminded, when the 30 days are counted
 * from, and how "Later" and an unchanged log keep it quiet.
 */
import { describe, it, expect } from 'vitest'
import { shouldRemindToBackUp, describeLastBackup, BACKUP_REMINDER_DAYS, BACKUP_SNOOZE_DAYS } from './backupReminder'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 10, 11, 9, 0, 0).getTime()

/** A record created and last changed `daysAgo` days before NOW. */
function record(daysAgo: number, changedDaysAgo = daysAgo) {
  return { createdAt: NOW - daysAgo * DAY, updatedAt: NOW - changedDaysAgo * DAY }
}

const base = { signedIn: false, lastBackupAt: null, snoozedAt: null, now: NOW }

describe('shouldRemindToBackUp', () => {
  it('stays quiet when there is nothing to back up', () => {
    expect(shouldRemindToBackUp({ ...base, records: [] })).toBe(false)
  })

  it('stays quiet for a signed-in user, whose data is already in the cloud', () => {
    expect(shouldRemindToBackUp({ ...base, signedIn: true, records: [record(90)] })).toBe(false)
  })

  it('does not nag a new user during their first month', () => {
    expect(shouldRemindToBackUp({ ...base, records: [record(BACKUP_REMINDER_DAYS - 1), record(2)] })).toBe(false)
  })

  it('reminds once the oldest record is a month old and no backup was ever made', () => {
    expect(shouldRemindToBackUp({ ...base, records: [record(BACKUP_REMINDER_DAYS), record(2)] })).toBe(true)
  })

  it('counts from the last backup once there is one', () => {
    const records = [record(200), record(1)]
    expect(shouldRemindToBackUp({ ...base, records, lastBackupAt: NOW - 29 * DAY })).toBe(false)
    expect(shouldRemindToBackUp({ ...base, records, lastBackupAt: NOW - 30 * DAY })).toBe(true)
  })

  it('stays quiet when nothing has changed since the last backup', () => {
    const records = [record(200), record(120, 60)]
    expect(shouldRemindToBackUp({ ...base, records, lastBackupAt: NOW - 45 * DAY })).toBe(false)
  })

  it('stays hidden for a week after "Later", then returns', () => {
    const records = [record(90)]
    expect(shouldRemindToBackUp({ ...base, records, snoozedAt: NOW - (BACKUP_SNOOZE_DAYS - 1) * DAY })).toBe(false)
    expect(shouldRemindToBackUp({ ...base, records, snoozedAt: NOW - BACKUP_SNOOZE_DAYS * DAY })).toBe(true)
  })
})

describe('describeLastBackup', () => {
  it('says Never when no backup was made', () => {
    expect(describeLastBackup(null, NOW)).toBe('Never')
  })

  it('describes recent backups in words and older ones in days', () => {
    expect(describeLastBackup(NOW - 60 * 1000, NOW)).toBe('Today')
    expect(describeLastBackup(NOW - DAY, NOW)).toBe('Yesterday')
    expect(describeLastBackup(NOW - 12 * DAY, NOW)).toBe('12 days ago')
  })

  it('treats a timestamp in the future (clock change) as today', () => {
    expect(describeLastBackup(NOW + DAY, NOW)).toBe('Today')
  })
})
