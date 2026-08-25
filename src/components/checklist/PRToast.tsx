import { useEffect } from 'react'

const DISMISS_DELAY_MS = 3200

/**
 * Brief celebratory toast shown when a logged performance beats a prior personal
 * record. Auto-dismisses after a few seconds. Callers should mount this only while
 * there's a message to show, keyed by an id that changes on every new PR (not just the
 * message text, which two different PRs can share) — so each one gets a fresh
 * celebrate-in animation via remount.
 */
export function PRToast({ message, onDismissed }: { message: string; onDismissed: () => void }) {
  useEffect(() => {
    const dismissTimer = setTimeout(onDismissed, DISMISS_DELAY_MS)
    return () => clearTimeout(dismissTimer)
  }, [onDismissed])

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm pwa-safe-top animate-celebrate-in">
      <div className="card p-4 flex items-center gap-3 border-lime-500/40 shadow-[0_16px_48px_-12px_rgba(198,255,94,0.25)]">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg animate-float"
          style={{ background: 'linear-gradient(135deg, rgba(198,255,94,0.35), rgba(255,90,43,0.2))' }}
        >
          🏆
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">New personal record! ✨</p>
          <p className="text-xs text-ink-muted mt-0.5">{message}</p>
        </div>
      </div>
    </div>
  )
}
