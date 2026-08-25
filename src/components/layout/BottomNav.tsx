import { useUIStore } from '@/stores/ui'
import { TABS } from './tabs'

/**
 * Fixed bottom tab bar shown on mobile viewports (hidden on sm+), mirroring the
 * native-app navigation pattern of apps like Strava. Drives the same UI store tab
 * state as TopBar so both stay in sync.
 */
export function BottomNav() {
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)

  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 pwa-safe-bottom bg-surface/95 backdrop-blur-lg border-t border-surface-border"
      aria-label="Primary"
    >
      <div className="grid grid-cols-7">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-1 py-2.5 focus:outline-none"
            >
              <span
                className={
                  active
                    ? 'w-9 h-7 flex items-center justify-center rounded-full transition-colors bg-accent-500/15 text-accent-400'
                    : 'w-9 h-7 flex items-center justify-center rounded-full transition-colors text-ink-faint'
                }
              >
                <Icon size={20} strokeWidth={2} />
              </span>
              <span
                className={
                  active
                    ? 'text-[10px] font-semibold tracking-tight text-accent-400'
                    : 'text-[10px] font-semibold tracking-tight text-ink-faint'
                }
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
