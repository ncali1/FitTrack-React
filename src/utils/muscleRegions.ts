/**
 * Maps exercise muscle-group names (e.g. "Chest", "Legs") to the abstract body regions
 * MuscleBodyDiagram highlights in red. Shared with the workout catalog's data typing.
 */
const REGION_IDS = [
  'shoulders',
  'chest',
  'core',
  'biceps',
  'triceps',
  'forearms',
  'back',
  'glutes',
  'quadriceps',
  'hamstrings',
  'calves',
] as const
export type RegionId = (typeof REGION_IDS)[number]

const MUSCLE_GROUP_TO_REGIONS: Record<string, RegionId[]> = {
  Chest: ['chest'],
  Back: ['back'],
  Shoulders: ['shoulders'],
  Biceps: ['biceps'],
  Triceps: ['triceps'],
  Forearms: ['forearms'],
  // "Legs" is a generic catch-all with no single region of its own — it lights up the
  // whole lower body rather than nothing.
  Legs: ['quadriceps', 'hamstrings', 'calves'],
  Quadriceps: ['quadriceps'],
  Hamstrings: ['hamstrings'],
  Calves: ['calves'],
  Glutes: ['glutes'],
  Core: ['core'],
}

/** Resolves exercise muscle-group names (e.g. "Chest", "Legs") to the model regions they highlight. */
export function activeRegionsFor(muscleGroups: string[]): Set<RegionId> {
  const regions = new Set<RegionId>()
  muscleGroups.forEach((group) => {
    for (const region of MUSCLE_GROUP_TO_REGIONS[group] ?? []) regions.add(region)
  })
  return regions
}

/**
 * The rep-loop archetypes a workout's movement can be approximated by. `press`/`row`/
 * `raise` animate a whole arm as one rigid group (shoulder-driven); `curl` animates only
 * the forearm sub-group (elbow-driven); `bob`/`lean`/`rise`/`twist` animate the entire
 * figure together; `bridge`/`pulse` animate a single highlighted region directly.
 */
export type MovementPattern = 'press' | 'row' | 'raise' | 'curl' | 'bob' | 'lean' | 'bridge' | 'rise' | 'pulse' | 'twist'
