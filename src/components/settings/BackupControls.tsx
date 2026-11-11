import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { reloadAllStores } from '@/stores/reloadAllStores'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { markRestorePending, syncWithCloud } from '@/services/cloudSync'
import { useBackupExport } from '@/hooks/useBackupExport'
import { readBackupFile, restoreBackup, InvalidBackupError, type RestoreCounts } from '@/utils/exportData'
import { describeLastBackup } from '@/utils/backupReminder'

function summarizeCounts(counts: RestoreCounts): string {
  return `${counts.exercises} exercises, ${counts.workoutTemplates} routines, ${counts.routines} programs, ${counts.workoutSessions} sessions, ${counts.bodyWeightLogs} body weight logs, ${counts.cardioSessions} cardio sessions`
}

/**
 * Gets restored records into the cloud account without holding up the import. Marked
 * first, so if this attempt fails (offline) the next sync still uploads them instead of
 * re-applying deletions the backup was meant to undo.
 */
function uploadRestoredData() {
  markRestorePending()
  const user = useAuthStore.getState().user
  if (!user) return
  syncWithCloud(user.id)
    .then((changed) => (changed ? reloadAllStores() : undefined))
    .catch((err) => console.error('Failed to sync restored backup:', err))
}

/**
 * Export / Import buttons for a full JSON backup, with their hidden file input and a note
 * of when this device was last backed up. Shared by SettingsPage and Profile so both
 * entry points behave identically.
 */
export function BackupControls() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const exportBackup = useBackupExport()
  const lastBackupAt = useSettingsStore((s) => s.lastBackupAt)
  const markBackedUp = useSettingsStore((s) => s.markBackedUp)
  // Read once on mount: render must stay pure, and "N days ago" only needs day precision.
  const [now] = useState(() => Date.now())

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      const backup = await readBackupFile(file)
      const counts = await restoreBackup(backup)
      await reloadAllStores()
      uploadRestoredData()
      // The file just restored is a backup of what it put here, so a phone set up from one
      // isn't immediately told it has never been backed up.
      markBackedUp()
      toast.success(`Backup restored: ${summarizeCounts(counts)}`)
    } catch (err) {
      console.error('Failed to import backup:', err)
      toast.error(err instanceof InvalidBackupError ? err.message : 'Failed to import backup')
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <button onClick={exportBackup} className="btn-secondary flex-1">
          <Download size={16} strokeWidth={2} />
          Export
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex-1">
          <Upload size={16} strokeWidth={2} />
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          aria-label="Import backup file"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
      <p className="text-xs text-ink-faint mt-2">Last backup: {describeLastBackup(lastBackupAt, now)}</p>
    </div>
  )
}
