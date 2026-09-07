/**
 * Works out which plates to load per side of a barbell for a target weight, so you don't
 * have to do the (bar + 2×plates) math yourself mid-set.
 */
import type { WeightUnit } from './units'

const STANDARD_BAR_KG = 20
const STANDARD_BAR_LB = 45

const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]
const PLATES_LB = [45, 35, 25, 10, 5, 2.5]

const EPSILON = 1e-6

export interface PlateLoading {
  barWeight: number
  /** Plates for one side, heaviest first — load the same set on the other side too. */
  platesPerSide: number[]
  /** Target weight left unaccounted for per side, when it can't be made exactly with the available plates. */
  leftoverPerSide: number
}

/**
 * @param totalWeight - Target total barbell weight, in `unit`.
 * @param unit - Which unit `totalWeight` is expressed in — determines the standard bar
 * weight (20kg / 45lb) and the plate set assumed available.
 */
export function calculatePlateLoading(totalWeight: number, unit: WeightUnit): PlateLoading {
  const barWeight = unit === 'kg' ? STANDARD_BAR_KG : STANDARD_BAR_LB
  const plates = unit === 'kg' ? PLATES_KG : PLATES_LB

  let remaining = Math.max(0, totalWeight - barWeight) / 2
  const platesPerSide: number[] = []

  for (const plate of plates) {
    while (remaining + EPSILON >= plate) {
      platesPerSide.push(plate)
      remaining -= plate
    }
  }

  return {
    barWeight,
    platesPerSide,
    leftoverPerSide: Math.round(remaining * 100) / 100,
  }
}

/** Formats a loading as a short, human-readable line, e.g. "20kg bar + 25 + 15 per side". */
export function formatPlateBreakdown(loading: PlateLoading, unit: WeightUnit): string {
  const { barWeight, platesPerSide, leftoverPerSide } = loading

  if (platesPerSide.length === 0 && leftoverPerSide === 0) {
    return `Just the bar (${barWeight}${unit})`
  }

  // Groups consecutive equal plates by value, e.g. [25, 20, 20] -> "25, 20×2".
  const counts: { value: number; count: number }[] = []
  for (const plate of platesPerSide) {
    const last = counts.at(-1)
    if (last && last.value === plate) {
      last.count += 1
    } else {
      counts.push({ value: plate, count: 1 })
    }
  }
  const grouped = counts.map(({ value, count }) => (count > 1 ? `${value}×${count}` : `${value}`))

  const line =
    grouped.length > 0
      ? `${barWeight}${unit} bar + ${grouped.join(', ')} per side`
      : `Just the bar (${barWeight}${unit})`

  return leftoverPerSide > 0 ? `${line} (+${leftoverPerSide}${unit} short per side)` : line
}
