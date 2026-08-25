import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'

/**
 * Root page layout wrapper. Renders the TopBar (brand + desktop nav) and, on small
 * screens, a fixed BottomNav tab bar. Provides a centred, max-width content area for
 * children with bottom padding to clear the mobile tab bar.
 */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28 sm:pb-10">{children}</main>
      <BottomNav />
    </div>
  )
}
