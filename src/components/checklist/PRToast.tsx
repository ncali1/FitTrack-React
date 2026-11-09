import { useEffect } from 'react'
import { Trophy } from 'lucide-react'

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
      <div className="bg-canvas border border-mark-500 border-l-4 rounded-sm p-4 flex items-center gap-3">
        <Trophy size={22} strokeWidth={2} className="text-mark-500 flex-shrink-0" aria-hidden="true" />
        <div>
          <p className="display text-lg text-mark-500">New personal record</p>
          <p className="text-xs text-ink-muted mt-0.5">{message}</p>
        </div>
      </div>
    </div>
  )
}
