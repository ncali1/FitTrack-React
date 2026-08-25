import { Lock } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { SetNewPasswordForm } from './SetNewPasswordForm'

/**
 * Full-screen gate shown when the user has followed a "forgot password" email link
 * (Supabase's PASSWORD_RECOVERY auth event). Blocks access to the rest of the app until
 * a new password is set, then hands off to the normal authenticated flow.
 */
export function PasswordRecoveryGate() {
  const exitPasswordRecovery = useAuthStore((s) => s.exitPasswordRecovery)

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-[0_8px_32px_-8px_rgba(255,90,43,0.7)] mb-4">
            <Lock size={26} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="text-ink">Set a new password</h1>
          <p className="text-ink-muted text-sm mt-1 text-center">
            You followed a password reset link. Choose a new password to finish.
          </p>
        </div>

        <div className="card-pad">
          <SetNewPasswordForm onDone={exitPasswordRecovery} />
        </div>
      </div>
    </div>
  )
}
