import { useUIStore } from '@/stores/ui'
import { TABS } from './tabs'

/**
 * Fixed bottom tab bar shown on mobile viewports (hidden on sm+), with the active tab
 * marked by an orange bar sitting on the heavy top rule, like a tab divider in a binder.
 * Drives the same UI store tab state as TopBar so both stay in sync.
 */
export function BottomNav() {
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)

  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 pwa-safe-bottom bg-canvas border-t-2 border-ink"
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'relative flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 min-h-14 text-accent-500 focus:outline-none focus-visible:bg-surface-hover'
                  : 'relative flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 min-h-14 text-ink-faint focus:outline-none focus-visible:bg-surface-hover'
              }
            >
              {active && <span className="absolute -top-0.5 inset-x-3 h-1 bg-accent-500" aria-hidden="true" />}
              <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em]">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
