import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthStore } from '@/stores/auth'

/**
 * Self-contained "new password + confirm" form that calls `authStore.updatePassword`
 * directly. Used both by PasswordRecoveryGate (after a forgot-password email link) and
 * ChangePasswordModal (a signed-in user voluntarily changing their password) — the
 * underlying Supabase call is identical in both cases.
 */
export function SetNewPasswordForm({ onDone }: { onDone: () => void }) {
  const error = useAuthStore((s) => s.error)
  const updatePassword = useAuthStore((s) => s.updatePassword)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const mismatchError = touched && confirm.length > 0 && password !== confirm

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (password !== confirm) return

    setSubmitting(true)
    setSuccessMessage(null)
    try {
      await updatePassword(password)
      setSuccessMessage('Password updated.')
      setTimeout(onDone, 900)
    } catch {
      // authStore.error already holds the message
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="new-password" className="field-label">
          New Password
        </label>
        <input
          id="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="field-input"
          placeholder="••••••••"
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="field-label">
          Confirm Password
        </label>
        <input
          id="confirm-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="field-input"
          placeholder="••••••••"
        />
        {mismatchError && <p className="field-error">Passwords don't match.</p>}
      </div>

      {error && (
        <div className="alert-error">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-3">
          <p className="text-lime-500 text-sm">{successMessage}</p>
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? 'Saving…' : 'Set New Password'}
      </button>
    </form>
  )
}
