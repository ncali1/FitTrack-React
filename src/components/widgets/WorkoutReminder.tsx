import { useEffect, useState } from 'react'
import { useRoutineStore, selectActiveRoutine } from '@/stores/routine'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useSettingsStore } from '@/stores/settings'
import { useRestTimerStore } from '@/stores/restTimer'
import { shouldNudgeToday } from '@/utils/reminders'

const LAST_NUDGE_KEY = 'fittrack-last-nudge-date'

type Mode = 'ask' | 'nudge' | null

/** Today's date as a YYYY-MM-DD string, matching the format used across the app. */
function todayString(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

/** `true` when the reminder (ask or nudge) has already been shown today. */
function alreadyShownToday(today: string): boolean {
  return localStorage.getItem(LAST_NUDGE_KEY) === today
}

function markShownToday(today: string) {
  localStorage.setItem(LAST_NUDGE_KEY, today)
}

/**
 * Local, in-app nudge shown when today is a day the active routine normally assigns a
 * workout to and nothing has been logged as completed yet. Runs once at app boot (no
 * background execution, since this is not Web Push) and at most once per calendar day,
 * tracked via a localStorage date-stamp.
 *
 * On the first qualifying day, shows an opt-in ask instead of a nudge — reminders are
 * off until the user explicitly enables them. The in-app toast is the primary surface; a
 * native `Notification` is also fired, but only as a secondary channel when the tab is
 * hidden and permission was already granted, since a foreground-only check makes a
 * native notification redundant most of the time.
 */
export function WorkoutReminder() {
  const setRemindersEnabled = useSettingsStore((s) => s.setRemindersEnabled)
  const restTimerActive = useRestTimerStore((s) => s.active)

  const [mode, setMode] = useState<Mode>(null)

  useEffect(() => {
    // Reads routines/sessions/remindersEnabled imperatively via getState() rather than
    // subscribing to them as reactive values, and runs with an empty dependency array —
    // deliberately a one-shot check "as of app boot", matching the original's onMounted
    // (which reads reactive refs' current .value once and never re-runs). Subscribing
    // reactively here would let the reminder fire mid-session the instant routines/
    // sessions change (e.g. right after assigning today's workout) rather than only at
    // the next app load, which is a real behavior change, not a harmless extra check —
    // alreadyShownToday() dedupes repeat *fires* but doesn't undo an early one.
    // Safe to read synchronously here because App.tsx only mounts this widget after
    // initializeApp() has already loaded both stores.
    const remindersEnabled = useSettingsStore.getState().remindersEnabled
    if (remindersEnabled === false) return

    const today = todayString()
    if (alreadyShownToday(today)) return
    const routine = selectActiveRoutine(useRoutineStore.getState().routines)
    const sessions = useWorkoutSessionsStore.getState().sessions
    if (!shouldNudgeToday(routine, sessions, today)) return

    markShownToday(today)
    const nextMode: Mode = remindersEnabled === null ? 'ask' : 'nudge'
    // Not derivable during render: reaching this point already wrote to localStorage
    // (markShownToday) and, below, may fire a native Notification — genuine
    // synchronization with external systems, which is what effects are for.
    // oxlint-disable-next-line react/set-state-in-effect
    setMode(nextMode)

    if (
      nextMode === 'nudge' &&
      document.visibilityState === 'hidden' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      new Notification('Time to train', {
        body: "You usually work out today — don't break the streak.",
      })
    }
  }, [])

  const visible = mode !== null && !restTimerActive

  /** Enables reminders going forward and requests native notification permission. */
  const enable = async () => {
    setRemindersEnabled(true)
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    setMode('nudge')
  }

  /** Opts out of reminders; won't ask again. */
  const disable = () => {
    setRemindersEnabled(false)
    setMode(null)
  }

  const dismiss = () => setMode(null)

  if (!visible) return null

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm pwa-safe-top">
      <div className="card p-4 flex items-start gap-3 border-accent-500/40 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.7)]">
        <div className="w-9 h-9 rounded-xl bg-accent-500/15 flex items-center justify-center flex-shrink-0 text-lg">💪</div>

        {mode === 'ask' ? (
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">You usually train today</p>
            <p className="text-xs text-ink-muted mt-0.5">Want a nudge like this on days you normally work out?</p>
            <div className="flex gap-2 mt-3">
              <button onClick={enable} className="btn-primary flex-1 !px-3 !py-1.5 text-xs">
                Enable
              </button>
              <button onClick={disable} className="btn-ghost flex-1 !px-3 !py-1.5 text-xs">
                No thanks
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">You usually train today</p>
            <p className="text-xs text-ink-muted mt-0.5">Nothing logged yet — get a session in?</p>
            <button onClick={dismiss} className="btn-ghost !px-3 !py-1.5 text-xs mt-3">
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
