import { useEffect, useState } from 'react'
import { useRestTimerStore } from '@/stores/restTimer'
import { useKeepAwake } from '@/hooks/useKeepAwake'
import { useSettingsStore } from '@/stores/settings'

const RADIUS = 24
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Floating countdown widget shown whenever the global rest timer is active. Callers
 * should mount this only while `useRestTimerStore((s) => s.active)` is true (see
 * App.tsx) rather than keeping it always-mounted and toggling visibility internally —
 * that way each activation is a fresh mount, so the enter animation below replays every
 * time instead of only on the very first rest period of the session. Being mounted only
 * while resting also makes it the natural place to keep the screen awake for the rest.
 */
export function RestTimer() {
  const remaining = useRestTimerStore((s) => s.remaining)
  const duration = useRestTimerStore((s) => s.duration)
  const adjust = useRestTimerStore((s) => s.adjust)
  const stop = useRestTimerStore((s) => s.stop)

  const [entered, setEntered] = useState(false)

  useKeepAwake(useSettingsStore((s) => s.keepScreenAwake))

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const fraction = duration > 0 ? remaining / duration : 0
  const dashOffset = CIRCUMFERENCE * (1 - fraction)

  return (
    <div
      className={`fixed left-4 right-4 bottom-24 sm:bottom-4 sm:left-4 sm:right-auto sm:w-72 z-50 pwa-safe-bottom transition duration-300 ease-out ${
        entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="bg-canvas border-2 border-accent-500 rounded-sm p-4 flex items-center gap-4">
        {/* Progress ring */}
        <svg viewBox="0 0 56 56" width="56" height="56" className="flex-shrink-0 -rotate-90">
          <circle cx="28" cy="28" r={RADIUS} fill="none" className="stroke-canvas-700" strokeWidth="5" />
          <circle
            cx="28"
            cy="28"
            r={RADIUS}
            fill="none"
            className="stroke-accent-500"
            strokeWidth="5"
            strokeLinecap="butt"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
          <text
            x="28"
            y="28"
            transform="rotate(90 28 28)"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-ink font-mono"
            fontSize="15"
            fontWeight="600"
          >
            {remaining}
          </text>
        </svg>

        <div className="flex-1 min-w-0">
          <p className="eyebrow">Rest timer</p>
          <div className="flex gap-1.5 mt-2">
            <button onClick={() => adjust(-15)} className="btn-secondary !px-2 !py-1 text-xs">
              -15s
            </button>
            <button onClick={() => adjust(15)} className="btn-secondary !px-2 !py-1 text-xs">
              +15s
            </button>
            <button onClick={stop} className="btn-ghost !px-2 !py-1 text-xs ml-auto">
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
