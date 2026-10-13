import { useExercisesStore } from './exercises'
import { useRoutineStore } from './routine'
import { useWorkoutTemplatesStore } from './workoutTemplates'
import { useWorkoutSessionsStore } from './workoutSessions'
import { useBodyWeightStore } from './bodyWeight'

/** Re-reads every data store from IndexedDB after something rewrote it underneath them. */
export async function reloadAllStores() {
  await Promise.all([
    useExercisesStore.getState().loadExercises(),
    useRoutineStore.getState().loadRoutines(),
    useWorkoutTemplatesStore.getState().loadTemplates(),
    useWorkoutSessionsStore.getState().loadSessions(),
    useBodyWeightStore.getState().loadLogs(),
  ])
}
