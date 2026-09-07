import { Home, Dumbbell, Library, TrendingUp, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface TabDef {
  id: string
  label: string
  icon: LucideIcon
}

/** Primary navigation tabs, shared between TopBar (desktop) and BottomNav (mobile). */
export const TABS: TabDef[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'train', label: 'Train', icon: Dumbbell },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'profile', label: 'Profile', icon: User },
]
