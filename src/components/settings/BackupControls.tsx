import { useRef } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { reloadAllStores } from '@/stores/reloadAllStores'
import { downloadBackup, readBackupFile, restoreBackup, InvalidBackupError, type RestoreCounts } from '@/utils/exportData'

function summarizeCounts(counts: RestoreCounts): string {
  return `${counts.exercises} exercises, ${counts.workoutTemplates} routines, ${counts.routines} programs, ${counts.workoutSessions} sessions, ${counts.bodyWeightLogs} body weight logs`
}

/**
 * Export / Import buttons for a full JSON backup, with their hidden file input. Shared
 * by SettingsPage and Profile so both entry points behave identically.
 */
export function BackupControls() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    try {
      await downloadBackup()
      toast.success('Backup downloaded')
    } catch (err) {
      console.error('Failed to export backup:', err)
      toast.error('Failed to export backup')
    }
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      const backup = await readBackupFile(file)
      const counts = await restoreBackup(backup)
      await reloadAllStores()
      toast.success(`Backup restored: ${summarizeCounts(counts)}`)
    } catch (err) {
      console.error('Failed to import backup:', err)
      toast.error(err instanceof InvalidBackupError ? err.message : 'Failed to import backup')
    }
  }

  return (
    <div className="flex gap-2">
      <button onClick={handleExport} className="btn-secondary flex-1">
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
  )
}
