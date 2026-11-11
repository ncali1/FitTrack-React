import { useCallback } from 'react'
import { toast } from 'sonner'
import { useSettingsStore } from '@/stores/settings'
import { downloadBackup } from '@/utils/exportData'

/**
 * Returns a function that downloads a full backup, records when it happened (which is
 * what quiets the backup reminder) and confirms with a toast. Shared so every "Export"
 * button behaves the same. Resolves to whether the export succeeded.
 */
export function useBackupExport(): () => Promise<boolean> {
  const markBackedUp = useSettingsStore((s) => s.markBackedUp)

  return useCallback(async () => {
    try {
      await downloadBackup()
      markBackedUp()
      toast.success('Backup downloaded')
      return true
    } catch (err) {
      console.error('Failed to export backup:', err)
      toast.error('Failed to export backup')
      return false
    }
  }, [markBackedUp])
}
