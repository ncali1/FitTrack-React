import { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import { useAppInitialization } from '@/hooks/useAppInitialization'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useRestTimerStore } from '@/stores/restTimer'
import { flushQueue, pullAndHydrate } from '@/services/cloudSync'
import { Layout } from '@/components/layout/Layout'
import { HomeDashboard } from '@/components/home/HomeDashboard'
import { WorkoutLibrary } from '@/components/library/WorkoutLibrary'
import { ProfileScreen } from '@/components/profile/ProfileScreen'
import { DailyChecklist } from '@/components/checklist/DailyChecklist'
import { AuthGate } from '@/components/auth/AuthGate'
import { PasswordRecoveryGate } from '@/components/auth/PasswordRecoveryGate'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { InstallPrompt } from '@/components/widgets/InstallPrompt'
import { RestTimer } from '@/components/widgets/RestTimer'
import { WorkoutReminder } from '@/components/widgets/WorkoutReminder'

// Lazy-loaded — Chart.js is the single biggest dependency in the app; splitting it out
// keeps it out of every other tab's initial bundle, only fetched when Progress is opened.
const ProgressGraphs = lazy(() =>
  import('@/components/progress/ProgressGraphs').then((m) => ({ default: m.ProgressGraphs }))
)

const SKIP_KEY = 'fittrack-skip-auth'
const ONBOARDING_KEY = 'fittrack-onboarding-complete'

function App() {
  const { initializeApp, isLoading, error } = useAppInitialization()
  const activeTab = useUIStore((s) => s.activeTab)
  const restTimerActive = useRestTimerStore((s) => s.active)

  const authInit = useAuthStore((s) => s.init)
  const cloudEnabled = useAuthStore((s) => s.cloudEnabled)
  const isAuthenticated = useAuthStore((s) => s.user !== null)
  const authUserId = useAuthStore((s) => s.user?.id ?? null)
  const passwordRecoveryMode = useAuthStore((s) => s.passwordRecoveryMode)

  const [skipped, setSkipped] = useState(() => localStorage.getItem(SKIP_KEY) === 'true')
  const [authReady, setAuthReady] = useState(false)
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARDING_KEY) === 'true')

  /** `true` once we know whether to show the auth gate, sign-in state resolved. */
  const showAuthGate = cloudEnabled && authReady && !isAuthenticated && !skipped

  /**
   * Loads local data, and — when signed in — first pulls the latest from the cloud and
   * flushes any queued offline writes so both devices converge on the same state.
   */
  const loadEverything = useCallback(async () => {
    if (cloudEnabled && authUserId) {
      try {
        await flushQueue(authUserId)
        await pullAndHydrate(authUserId)
      } catch (err) {
        console.error('Cloud sync failed, continuing with local data:', err)
      }
    }
    try {
      await initializeApp()
    } catch (err) {
      console.error('Failed to initialize app:', err)
    }
  }, [cloudEnabled, authUserId, initializeApp])

  /** Dismisses the auth gate for this device without signing in. */
  const skipAuth = () => {
    localStorage.setItem(SKIP_KEY, 'true')
    setSkipped(true)
  }

  /** Marks first-launch onboarding as seen for this device — shown once, ever. */
  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setOnboarded(true)
  }

  useEffect(() => {
    authInit().then(() => setAuthReady(true))
  }, [authInit])

  // Loads everything once we know whether to show the auth gate, and again whenever the
  // user signs in (authUserId flips from null to a real id) — mirrors the original's
  // "onMounted, then watch(isAuthenticated)" combination.
  useEffect(() => {
    if (authReady && !showAuthGate) {
      loadEverything()
    }
  }, [authReady, showAuthGate, loadEverything])

  if (passwordRecoveryMode) {
    return <PasswordRecoveryGate />
  }

  if (!onboarded) {
    return <Onboarding onFinish={finishOnboarding} />
  }

  if (showAuthGate) {
    return <AuthGate onSkip={skipAuth} />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-glow animate-pulse">
          <span className="text-white font-extrabold text-xl">FT</span>
        </div>
        <p className="text-ink-muted text-sm font-medium tracking-wide">Loading your training data…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-8">
        <div className="text-4xl">⚠️</div>
        <p className="text-ink text-center max-w-md">{error}</p>
        <button className="btn-primary" onClick={() => initializeApp()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <Layout>
        <div key={activeTab} className="animate-pop-in">
          {activeTab === 'home' ? (
            <HomeDashboard />
          ) : activeTab === 'train' ? (
            <DailyChecklist />
          ) : activeTab === 'library' ? (
            <WorkoutLibrary />
          ) : activeTab === 'progress' ? (
            <Suspense fallback={<div className="card-pad text-center py-14 text-ink-faint">Loading charts…</div>}>
              <ProgressGraphs />
            </Suspense>
          ) : (
            <ProfileScreen />
          )}
        </div>
      </Layout>
      <InstallPrompt />
      {restTimerActive && <RestTimer />}
      <WorkoutReminder />
    </>
  )
}

export default App
