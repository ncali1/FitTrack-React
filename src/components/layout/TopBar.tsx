import { useState } from 'react'
import { createPortal } from 'react-dom'
import { User, Settings } from 'lucide-react'
import { useUIStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { TABS } from './tabs'

/**
 * Sticky top header with app branding and, on sm+ viewports, a pill-style desktop tab
 * row. On mobile the primary navigation instead lives in BottomNav. The settings gear
 * always opens SettingsPage regardless of auth state, since those are local device
 * preferences. When cloud sync is configured and the user is signed in, also shows an
 * account menu button (synced indicator, change password, sign out) as a dropdown to
 * keep the header compact.
 */
export function TopBar() {
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const toggleWeightUnit = useSettingsStore((s) => s.toggleWeightUnit)

  const cloudEnabled = useAuthStore((s) => s.cloudEnabled)
  const isAuthenticated = useAuthStore((s) => s.user !== null)
  const signOut = useAuthStore((s) => s.signOut)

  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const openChangePassword = () => {
    setShowChangePassword(true)
    setShowAccountMenu(false)
  }

  const handleSignOut = () => {
    signOut()
    setShowAccountMenu(false)
  }

  return (
    <header className="sticky top-0 z-40 pwa-safe-top bg-canvas/85 backdrop-blur-lg border-b border-surface-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-[0_4px_16px_-4px_rgba(255,90,43,0.7)]">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                <path d="M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
              </svg>
            </div>
            <span className="text-lg font-extrabold tracking-tight text-ink">FitTrack</span>
          </div>

          {/* Desktop nav — min-w-0 lets it shrink instead of overflowing onto neighbors;
              overflow-x-auto is a safety net so a future tab addition scrolls instead of clipping */}
          <nav className="hidden sm:flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar" aria-label="Primary">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={
                  activeTab === tab.id
                    ? 'px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 bg-accent-500 text-white shadow-[0_4px_16px_-4px_rgba(255,90,43,0.6)]'
                    : 'px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 text-ink-muted hover:text-ink hover:bg-surface-hover'
                }
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Utility controls */}
          <div className="flex items-center gap-2 justify-end flex-shrink-0 relative">
            <button
              onClick={toggleWeightUnit}
              className="inline-flex btn-ghost !px-2.5 !py-1.5 text-xs font-semibold"
              title={`Switch to ${weightUnit === 'kg' ? 'lb' : 'kg'}`}
            >
              {weightUnit === 'kg' ? 'KG' : 'LB'}
            </button>

            <button onClick={() => setShowSettings(true)} className="btn-icon" aria-label="Settings">
              <Settings size={18} strokeWidth={2} />
            </button>

            {cloudEnabled && isAuthenticated && (
              <>
                <button
                  onClick={() => setShowAccountMenu((v) => !v)}
                  className="btn-icon"
                  aria-label="Account menu"
                  aria-expanded={showAccountMenu}
                >
                  <User size={18} strokeWidth={2} />
                </button>

                {showAccountMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAccountMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 card p-2 z-20 space-y-1">
                      <div className="badge-lime w-full justify-center">Synced with the cloud</div>
                      <button onClick={openChangePassword} className="btn-ghost w-full !justify-start text-sm">
                        Change password
                      </button>
                      <button onClick={handleSignOut} className="btn-ghost w-full !justify-start text-sm">
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/*
        Portaled to <body> — this header has `backdrop-blur-lg` (a backdrop-filter), which
        creates a new containing block for descendant `position: fixed` elements per the CSS
        spec. Without the portal, the modal's "fixed, fill the viewport" overlay instead
        resolves against this 64px-tall sticky header, so it renders squashed into the top
        of the screen with most of it clipped off-screen.
      */}
      {showChangePassword &&
        createPortal(<ChangePasswordModal onClose={() => setShowChangePassword(false)} />, document.body)}
      {showSettings && createPortal(<SettingsPage onClose={() => setShowSettings(false)} />, document.body)}
    </header>
  )
}
