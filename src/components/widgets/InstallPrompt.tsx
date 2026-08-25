import { useEffect, useRef, useState } from 'react'
import { useRestTimerStore } from '@/stores/restTimer'

const DISMISS_KEY = 'fittrack-install-dismissed-at'
const DISMISS_DAYS = 14

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** `true` when the app is already running as an installed/standalone PWA. */
function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** `true` when the dismissal cooldown period hasn't elapsed yet. */
function recentlyDismissed(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const dismissedAt = Number(raw)
  const elapsedDays = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
  return elapsedDays < DISMISS_DAYS
}

/**
 * Surfaces a custom install banner for the PWA. On Android / desktop Chrome it captures
 * the native `beforeinstallprompt` event and triggers it on demand. On iOS Safari (which
 * has no such event) it instead shows manual "Add to Home Screen" instructions. The
 * banner is suppressed once the app is already running standalone, or after the user
 * dismisses it (remembered in localStorage for 14 days).
 */
export function InstallPrompt() {
  const restTimerActive = useRestTimerStore((s) => s.active)

  const [visible, setVisible] = useState(false)
  const [isIOS] = useState(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !('MSStream' in window))
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    if (isIOS) {
      // No native prompt on iOS — show manual instructions after a short delay
      const timer = setTimeout(() => {
        if (!isStandalone()) setVisible(true)
      }, 2500)
      return () => clearTimeout(timer)
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setVisible(true)
    }
    const handleAppInstalled = () => {
      setVisible(false)
      deferredPromptRef.current = null
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [isIOS])

  /**
   * Triggers the native browser install prompt (Android / desktop Chrome, Edge). Hides
   * the banner regardless of the user's choice once the prompt resolves.
   */
  const install = async () => {
    const deferredPrompt = deferredPromptRef.current
    if (!deferredPrompt) {
      setVisible(false)
      return
    }
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    deferredPromptRef.current = null
    setVisible(false)
  }

  /** Dismisses the banner and remembers the dismissal so it doesn't reappear for DISMISS_DAYS. */
  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }

  if (!visible || restTimerActive) return null

  return (
    <div className="fixed left-4 right-4 bottom-24 sm:bottom-4 sm:left-auto sm:right-4 sm:w-80 z-50 pwa-safe-bottom">
      <div className="card p-4 flex gap-3 items-start shadow-[0_16px_48px_-12px_rgba(0,0,0,0.7)]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v13m0 0-4-4m4 4 4-4M5 21h14" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink">Install FitTrack</p>
          <p className="text-xs text-ink-muted mt-0.5 leading-snug">
            {isIOS ? (
              <>
                Tap <span className="font-semibold text-ink">Share</span> then{' '}
                <span className="font-semibold text-ink">Add to Home Screen</span> to install.
              </>
            ) : (
              'Add it to your home screen for a full-screen, offline-ready app.'
            )}
          </p>
          <div className="flex gap-2 mt-3">
            {!isIOS && (
              <button onClick={install} className="btn-primary !py-1.5 !px-3 text-xs">
                Install
              </button>
            )}
            <button onClick={dismiss} className="btn-ghost !py-1.5 !px-3 text-xs">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
