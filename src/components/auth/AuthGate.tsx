import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthStore } from '@/stores/auth'

type Mode = 'signIn' | 'signUp' | 'forgot'

/**
 * Sign-in / sign-up / forgot-password screen shown when cloud sync is configured but
 * the user isn't authenticated yet. Offers a "Skip for now" escape hatch so the app
 * remains usable in local-only mode without an account.
 */
export function AuthGate({ onSkip }: { onSkip: () => void }) {
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset)

  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const modeLabel =
    mode === 'forgot'
      ? 'Reset your password'
      : mode === 'signUp'
        ? 'Create an account to sync across devices'
        : 'Sign in to sync your data'

  const switchMode = (next: Mode) => {
    setMode(next)
    clearError()
    setInfoMessage(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setInfoMessage(null)
    try {
      if (mode === 'signIn') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        setInfoMessage('Check your email to confirm your account, then sign in.')
        setMode('signIn')
      }
    } catch {
      // authStore.error already holds the message
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Sends a password-reset email for the entered address, then shows a confirmation
   * message. Always shows the same message regardless of whether the email exists, so
   * as not to leak which addresses have accounts.
   */
  const submitForgotPassword = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setInfoMessage(null)
    try {
      await sendPasswordReset(email)
      setInfoMessage("If that email has an account, we've sent a reset link. Check your inbox.")
    } catch {
      // authStore.error already holds the message
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-[0_8px_32px_-8px_rgba(255,90,43,0.7)] mb-4">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" className="text-white">
              <path d="M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
            </svg>
          </div>
          <h1 className="text-ink">FitTrack</h1>
          <p className="text-ink-muted text-sm mt-1">{modeLabel}</p>
        </div>

        {mode !== 'forgot' ? (
          <form onSubmit={submit} className="card-pad space-y-4">
            <div>
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
                className="field-input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="field-label">
                Password
              </label>
              <input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                className="field-input"
                placeholder="••••••••"
              />
              {mode === 'signIn' && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs text-ink-muted hover:text-accent-400 mt-1.5"
                >
                  Forgot password?
                </button>
              )}
            </div>

            {error && (
              <div className="alert-error">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            {infoMessage && (
              <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-3">
                <p className="text-lime-500 text-sm">{infoMessage}</p>
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Please wait…' : mode === 'signIn' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitForgotPassword} className="card-pad space-y-4">
            <div>
              <label htmlFor="reset-email" className="field-label">
                Email
              </label>
              <input
                id="reset-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
                className="field-input"
                placeholder="you@example.com"
              />
              <p className="text-xs text-ink-muted mt-1.5">We'll send a link to reset your password.</p>
            </div>

            {error && (
              <div className="alert-error">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            {infoMessage && (
              <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-3">
                <p className="text-lime-500 text-sm">{infoMessage}</p>
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-ink-muted mt-5">
          {mode === 'signIn' ? (
            <>
              Don't have an account?{' '}
              <button onClick={() => switchMode('signUp')} className="text-accent-400 font-semibold hover:text-accent-400/80">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => switchMode('signIn')} className="text-accent-400 font-semibold hover:text-accent-400/80">
                Sign in
              </button>
            </>
          )}
        </p>

        <button onClick={onSkip} className="w-full mt-6 text-xs text-ink-faint hover:text-ink-muted">
          Skip for now — use this device only
        </button>
      </div>
    </div>
  )
}
