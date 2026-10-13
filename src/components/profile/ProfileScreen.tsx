import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Dumbbell } from 'lucide-react'
import { useRoutineStore, selectActiveRoutine } from '@/stores/routine'
import { useWorkoutTemplatesStore } from '@/stores/workoutTemplates'
import { useAuthStore } from '@/stores/auth'
import { ExerciseManager } from '@/components/exercises/ExerciseManager'
import { ProfileStats } from './ProfileStats'
import { RoutinesCard } from './RoutinesCard'
import { ProgramsCard } from './ProgramsCard'
import { PreferencesCard } from './PreferencesCard'
import { DataAccountCard } from './DataAccountCard'

/** Full-screen sheet wrapping ExerciseManager, portaled for the same reason every other
 *  overlay in this app is — an ancestor's lingering transform breaks `position: fixed`. */
function ExerciseManagerSheet({ onClose }: { onClose: () => void }) {
  return createPortal(
    // z-55, deliberately below .modal-overlay's z-60 — ExerciseForm opens as a modal
    // from inside this sheet, and needs to stack above it rather than behind it.
    <div className="fixed inset-0 z-[55] bg-canvas flex flex-col">
      <div className="flex-none pwa-safe-top flex items-center justify-between px-5 py-4 border-b border-surface-border">
        <h3 className="text-ink">Your exercises</h3>
        <button onClick={onClose} className="btn-icon" aria-label="Close">
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 pwa-safe-bottom">
        <ExerciseManager />
      </div>
    </div>,
    document.body
  )
}

/**
 * The Profile tab: lifetime stats, the user's routines and weekly plan, the exercise
 * manager, per-device preferences, and data/account controls. Each section is its own
 * card component; this screen only lays them out and owns the shared error banner.
 */
export function ProfileScreen() {
  const activeProgram = selectActiveRoutine(useRoutineStore((s) => s.routines))
  const routineCount = useWorkoutTemplatesStore((s) => s.templates.length)

  const cloudEnabled = useAuthStore((s) => s.cloudEnabled)
  const isAuthenticated = useAuthStore((s) => s.user !== null)
  const userEmail = useAuthStore((s) => s.user?.email ?? null)
  const signOut = useAuthStore((s) => s.signOut)

  const [showExerciseManager, setShowExerciseManager] = useState(false)
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

      <button className="btn-secondary w-full" onClick={() => setShowExerciseManager(true)}>
        <Dumbbell size={16} strokeWidth={2} />
        Manage exercises
      </button>

      <PreferencesCard />

      <DataAccountCard />

      {cloudEnabled && isAuthenticated && (
        <button className="btn-ghost w-full justify-center" onClick={() => signOut()}>
          Sign out
        </button>
      )}

      {showExerciseManager && <ExerciseManagerSheet onClose={() => setShowExerciseManager(false)} />}
    </div>
  )
}
