import { Dumbbell, CalendarDays, CircleCheckBig, LayoutGrid, TrendingUp, Scale, Library } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface TabDef {
  id: string
  label: string
  icon: LucideIcon
}

/** Primary navigation tabs, shared between TopBar (desktop) and BottomNav (mobile). */
export const TABS: TabDef[] = [
  { id: 'exercises', label: 'Exercises', icon: Dumbbell },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'routine', label: 'Routine', icon: CalendarDays },
  { id: 'checklist', label: 'Today', icon: CircleCheckBig },
  { id: 'summary', label: 'Summary', icon: LayoutGrid },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'bodyweight', label: 'Weight', icon: Scale },
]
