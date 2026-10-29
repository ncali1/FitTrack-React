import { useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth'
import { storageService } from '@/services/storage'
import { deleteAllCloudData, clearSyncQueue } from '@/services/cloudSync'
import { reloadAllStores } from '@/stores/reloadAllStores'
import { BackupControls } from '@/components/settings/BackupControls'
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal'

/**
 * Backup, account, and about: export/import, cloud sync status, change password, privacy
 * policy, app version, and a full "delete all my data" reset.
 */
export function DataAccountCard() {
  const cloudEnabled = useAuthStore((s) => s.cloudEnabled)
  const user = useAuthStore((s) => s.user)

  const [showChangePassword, setShowChangePassword] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteAll = async () => {
    setDeleting(true)
    try {
      // Cloud first: if it fails we stop with the local copy intact, rather than wiping
      // this device only for the next sync to bring everything back.
      if (user) await deleteAllCloudData(user.id)
      clearSyncQueue()
      await storageService.clearAllData()
      await reloadAllStores()
      setConfirmingDelete(false)
      toast.success('All data deleted')
    } catch (err) {
      console.error('Failed to delete all data:', err)
      toast.error('Failed to delete your data. Nothing on this device was removed.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="card-pad space-y-4">
      <h3 className="text-ink text-sm">Data &amp; account</h3>

      <div>
        <span className="field-label">Backup</span>
        <BackupControls />
      </div>

      <div className="divide-y divide-surface-border">
        {cloudEnabled && (
          <div className="flex items-center justify-between py-2.5 first:pt-0">
            <span className="text-sm text-ink">Cloud sync</span>
            {user ? <span className="badge-lime">Synced</span> : <span className="text-xs text-ink-faint">Not signed in</span>}
          </div>
        )}

        {cloudEnabled && user && (
          <button
            onClick={() => setShowChangePassword(true)}
            className="w-full flex items-center justify-between py-2.5 first:pt-0 text-sm text-ink text-left"
          >
            Change password
            <span className="text-ink-faint">›</span>
          </button>
        )}

        <a
          href={`${import.meta.env.BASE_URL}privacy.html`}
          target="_blank"
          rel="noopener"
          className="flex items-center justify-between py-2.5 first:pt-0 text-sm text-ink"
        >
          Privacy policy
          <span className="text-ink-faint">›</span>
        </a>

        <div className="flex items-center justify-between py-2.5">
          <span className="text-sm text-ink">Version</span>
          <span className="text-xs text-ink-muted">{__APP_VERSION__}</span>
        </div>
      </div>

      {confirmingDelete ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 space-y-3">
          <p className="text-sm text-ink">
            This permanently deletes every exercise, routine, program, workout, cardio session, and body weight entry on this device
            {user ? ' and in your cloud account' : ''}. Export a backup first if you might want it back.
          </p>
          {cloudEnabled && !user && (
            <p className="text-xs text-ink-muted">
              You’re signed out, so anything already synced to your account stays there and will return when you sign
              in.
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={handleDeleteAll} disabled={deleting} className="btn-danger flex-1">
              {deleting ? 'Deleting…' : 'Yes, delete everything'}
            </button>
            <button onClick={() => setConfirmingDelete(false)} disabled={deleting} className="btn-ghost flex-1">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmingDelete(true)} className="btn-danger w-full">
          Delete all my data
        </button>
      )}

      {showChangePassword &&
        createPortal(<ChangePasswordModal onClose={() => setShowChangePassword(false)} />, document.body)}
    </div>
  )
}
