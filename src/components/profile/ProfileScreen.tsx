import { useState } from 'react'
import { useRoutineStore, selectActiveRoutine } from '@/stores/routine'
import { useWorkoutTemplatesStore } from '@/stores/workoutTemplates'
import { useAuthStore } from '@/stores/auth'
import { ProfileStats } from './ProfileStats'
import { RoutinesCard } from './RoutinesCard'
import { ProgramsCard } from './ProgramsCard'
import { PreferencesCard } from './PreferencesCard'
import { DataAccountCard } from './DataAccountCard'

/**
 * The Profile tab: lifetime stats, the user's routines and weekly plan, per-device
 * preferences, and data/account controls. (The user's exercises are managed from Library.) Each section is its own
 * card component; this screen only lays them out and owns the shared error banner.
 */
export function ProfileScreen() {
  const activeProgram = selectActiveRoutine(useRoutineStore((s) => s.routines))
  const routineCount = useWorkoutTemplatesStore((s) => s.templates.length)

  const cloudEnabled = useAuthStore((s) => s.cloudEnabled)
  const isAuthenticated = useAuthStore((s) => s.user !== null)
  const userEmail = useAuthStore((s) => s.user?.email ?? null)
  const signOut = useAuthStore((s) => s.signOut)

  const [error, setError] = useState<string | null>(null)

  const initial = userEmail ? userEmail[0]!.toUpperCase() : 'Y'
  const displayName = userEmail ?? 'You'

  return (
    <div className="space-y-5">
      {error && (
        <div className="alert-error">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 ml-2 text-lg leading-none"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-accent-800 text-accent-100 flex items-center justify-center text-xl font-semibold flex-none">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold text-ink truncate">{displayName}</div>
          <div className="text-xs text-ink-muted mt-0.5">
            {activeProgram?.name ?? 'No active program'} · {routineCount} {routineCount === 1 ? 'routine' : 'routines'}
          </div>
        </div>
      </div>

      <ProfileStats />

      <RoutinesCard onError={setError} />

      <ProgramsCard onError={setError} />

      <PreferencesCard />

      <DataAccountCard />

      {cloudEnabled && isAuthenticated && (
        <button className="btn-ghost w-full justify-center" onClick={() => signOut()}>
          Sign out
        </button>
      )}

    </div>
  )
}
