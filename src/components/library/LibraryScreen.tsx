import { useState } from 'react'
import { WorkoutLibrary } from './WorkoutLibrary'
import { ExerciseManager } from '@/components/exercises/ExerciseManager'

type View = 'browse' | 'mine'

const VIEWS: { id: View; label: string }[] = [
  { id: 'browse', label: 'Browse' },
  { id: 'mine', label: 'My exercises' },
]

/**
 * The Library tab: the built-in exercise catalog ("Browse") and the user's own exercises
 * ("My exercises", where they are created, edited, and deleted), switched by a segmented
 * control at the top.
 */
export function LibraryScreen() {
  const [view, setView] = useState<View>('browse')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-canvas-800 border border-surface-border" role="tablist">
        {VIEWS.map((option) => (
          <button
            key={option.id}
            role="tab"
            aria-selected={view === option.id}
            onClick={() => setView(option.id)}
            className={
              view === option.id
                ? 'py-2 rounded-lg text-sm font-semibold bg-surface text-ink shadow-card'
                : 'py-2 rounded-lg text-sm font-semibold text-ink-muted'
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {view === 'browse' ? <WorkoutLibrary /> : <ExerciseManager />}
    </div>
  )
}
