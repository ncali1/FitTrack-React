import { useRoutineStore, selectEffectiveRoutine } from '@/stores/routine'
import { useWorkoutTemplatesStore } from '@/stores/workoutTemplates'
import type { Routine } from '@/types'

/**
 * The active weekly program in resolved form — each day's `weeklyAssignments` already
 * includes the exercises of the templates assigned to it — or null if there is none.
 * Re-renders when either the programs or the templates change. Use this for anything
 * that displays or computes from the plan; editing screens need the raw routine instead.
 */
export function useActiveProgram(): Routine | null {
  const routines = useRoutineStore((s) => s.routines)
  const templates = useWorkoutTemplatesStore((s) => s.templates)
  return selectEffectiveRoutine(routines, templates)
}
