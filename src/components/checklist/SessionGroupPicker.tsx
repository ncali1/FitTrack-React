import { useState } from 'react'
import { X } from 'lucide-react'
import type { Exercise } from '@/types'

/**
 * Pre-session step for organizing pending exercises into supersets before starting a
 * guided workout: tap 2+ ungrouped exercises then "Group selected" to combine them into
 * one superset (logged back-to-back with no rest between members — only after the whole
 * group). Everything starts as its own singleton group, so skipping this entirely and
 * hitting "Start session" reproduces today's plain one-at-a-time behavior exactly.
 */
export function SessionGroupPicker({
  exercises,
  onStart,
  onCancel,
}: {
  exercises: Exercise[]
  onStart: (groups: Exercise[][]) => void
  onCancel: () => void
}) {
  const [groups, setGroups] = useState<Exercise[][]>(() => exercises.map((ex) => [ex]))
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelect = (exerciseId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(exerciseId)) next.delete(exerciseId)
      else next.add(exerciseId)
      return next
    })
  }

  const groupSelected = () => {
    if (selected.size < 2) return
    setGroups((prev) => {
      const chosen: Exercise[] = []
      const remaining: Exercise[][] = []
      for (const group of prev) {
        if (group.length === 1 && selected.has(group[0]!.id)) {
          chosen.push(group[0]!)
        } else {
          remaining.push(group)
        }
      }
      return [...remaining, chosen]
    })
    setSelected(new Set())
  }

  const ungroup = (group: Exercise[]) => {
    setGroups((prev) => {
      const index = prev.indexOf(group)
      if (index === -1) return prev
      const singles = group.map((ex) => [ex])
      return [...prev.slice(0, index), ...singles, ...prev.slice(index + 1)]
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-ink">Organize your session</h3>
          <p className="text-ink-muted text-xs mt-0.5">
            Optionally group exercises into supersets — logged back-to-back, resting only after the group.
          </p>
        </div>
        <button onClick={onCancel} className="btn-icon flex-none" aria-label="Cancel">
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {groups.map((group, i) =>
          group.length === 1 ? (
            <button
              key={group[0]!.id}
              onClick={() => toggleSelect(group[0]!.id)}
              aria-pressed={selected.has(group[0]!.id)}
              className={
                selected.has(group[0]!.id)
                  ? 'px-3.5 py-2 rounded-xl text-sm bg-accent-500/15 border border-accent text-ink'
                  : 'px-3.5 py-2 rounded-xl text-sm bg-surface border border-surface-border text-ink'
              }
            >
              {group[0]!.name}
            </button>
          ) : (
            <div key={`group-${i}`} className="w-full card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-accent-400">Superset</span>
                <button onClick={() => ungroup(group)} className="btn-ghost !px-2 !py-1 text-xs">
                  Ungroup
                </button>
              </div>
              <p className="text-sm text-ink">{group.map((ex) => ex.name).join(' + ')}</p>
            </div>
          )
        )}
      </div>

      {selected.size >= 2 && (
        <button className="btn-secondary w-full" onClick={groupSelected}>
          Group selected ({selected.size})
        </button>
      )}

      <button className="btn-primary w-full" onClick={() => onStart(groups)}>
        Start session
      </button>
    </div>
  )
}
