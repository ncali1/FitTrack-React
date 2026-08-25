import { X } from 'lucide-react'
import { SetNewPasswordForm } from './SetNewPasswordForm'

/**
 * Modal allowing an already signed-in user to voluntarily change their password (as
 * opposed to PasswordRecoveryGate, which handles the "forgot password" email-link
 * flow). Opened from TopBar's account menu.
 */
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-panel">
        <div className="p-6">
          <div className="section-header mb-5">
            <h2 className="text-ink">Change Password</h2>
            <button onClick={onClose} className="btn-icon" aria-label="Close">
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <SetNewPasswordForm onDone={onClose} />
        </div>
      </div>
    </div>
  )
}
