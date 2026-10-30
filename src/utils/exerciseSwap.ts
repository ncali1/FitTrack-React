/**
 * Finds stand-in exercises for when the planned one isn't possible right now — the machine
 * is taken, the bench is busy — by matching muscle regions rather than exact group names,
 * so "Legs" and "Quadriceps" still count as overlapping.
 */
import type { Exercise } from '@/types'
import type { LibraryWorkout } from '@/data/workoutLibrary'
import { activeRegionsFor } from './muscleRegions'
import type { MovementPattern } from './muscleRegions'

export interface SwapCandidate {
  name: string
  targetMuscleGroups: string[]
  /** From the matching library entry, when there is one — drives the animated preview. */
  movementPattern?: MovementPattern
  /** The user's own exercise, when they already have one by this name. */
  exercise?: Exercise
  /** The catalog entry, when this candidate exists in the built-in library. */
  libraryWorkout?: LibraryWorkout
}

/** Bonus for a candidate whose main muscle is the target's main muscle — a bench press
 *  is a better swap for a chest fly than a dip that only shares the triceps. */
const PRIMARY_MATCH_BONUS = 2

function overlap(a: Set<string>, b: Set<string>): number {
  let count = 0
  for (const x of a) if (b.has(x)) count += 1
  return count
}

/**
 * @param target - The exercise being replaced.
 * @param exercises - The user's own exercises.
 * @param library - The built-in catalog.
 * @param excludeNames - Names to leave out (case-insensitive), e.g. everything already in
 * today's session, so a swap never duplicates an exercise you're about to do anyway.
 * @returns Candidates sharing at least one muscle region with the target, best match
 * first. A user exercise and a library entry with the same name merge into one candidate.
 */
export function findSwapCandidates(
  target: Pick<Exercise, 'name' | 'targetMuscleGroups'>,
  exercises: Exercise[],
  library: LibraryWorkout[],
  excludeNames: string[] = []
): SwapCandidate[] {
  const targetRegions = activeRegionsFor(target.targetMuscleGroups)
  if (targetRegions.size === 0) return []
  const targetPrimary = activeRegionsFor(target.targetMuscleGroups.slice(0, 1))

  const excluded = new Set([target.name, ...excludeNames].map((n) => n.toLowerCase()))
  const byName = new Map<string, SwapCandidate>()

  for (const workout of library) {
    const key = workout.name.toLowerCase()
    if (excluded.has(key)) continue
    byName.set(key, {
      name: workout.name,
      targetMuscleGroups: workout.targetMuscleGroups,
      movementPattern: workout.movementPattern,
      libraryWorkout: workout,
    })
  }
  for (const exercise of exercises) {
    const key = exercise.name.toLowerCase()
    if (excluded.has(key)) continue
    const existing = byName.get(key)
    // The user's own muscle groups win — they may have retagged a library exercise.
    byName.set(key, {
      ...existing,
      name: exercise.name,
      targetMuscleGroups: exercise.targetMuscleGroups,
      exercise,
    })
  }

  const scored = [...byName.values()]
    .map((candidate) => {
      const shared = overlap(activeRegionsFor(candidate.targetMuscleGroups), targetRegions)
      const primary = overlap(activeRegionsFor(candidate.targetMuscleGroups.slice(0, 1)), targetPrimary) > 0
      return { candidate, shared, score: shared + (primary ? PRIMARY_MATCH_BONUS : 0) }
    })
    .filter(({ shared }) => shared > 0)

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      // On a tie, prefer exercises the user already does.
      Number(Boolean(b.candidate.exercise)) - Number(Boolean(a.candidate.exercise)) ||
      a.candidate.name.localeCompare(b.candidate.name)
  )

  return scored.map(({ candidate }) => candidate)
}
