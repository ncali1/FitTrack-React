/**
 * Weight-unit conversion helpers. All weight is stored canonically in
 * kilograms everywhere in the data layer (IndexedDB, calculations) — these
 * helpers only convert at the display/input boundary, so switching units is purely
 * cosmetic and never touches stored data or historical charts' underlying values.
 */

const KG_PER_LB = 0.45359237

export type WeightUnit = 'kg' | 'lb'

/** Converts a kilogram value to pounds. */
export function kgToLb(kg: number): number {
  return kg / KG_PER_LB
}

/** Converts a pound value to kilograms. */
export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}

/**
 * Converts a canonical kg value to the given display unit.
 * @param kg - Weight in kilograms (the canonical stored unit)
 * @param unit - Unit to convert to
 * @returns The converted value, or `null` if `kg` is null/undefined
 */
export function fromKg(kg: number | null | undefined, unit: WeightUnit): number | null {
  if (kg === null || kg === undefined) return null
  return unit === 'lb' ? kgToLb(kg) : kg
}

/**
 * Converts a value entered in the given display unit back to canonical kg for storage.
 * @param value - Weight in the given unit
 * @param unit - Unit the value is currently expressed in
 * @returns The value converted to kilograms, or `null` if `value` is null/undefined
 */
export function toKg(value: number | null | undefined, unit: WeightUnit): number | null {
  if (value === null || value === undefined) return null
  return unit === 'lb' ? lbToKg(value) : value
}

/**
 * Formats a canonical kg value for display in the given unit, rounded to a sensible
 * number of decimal places.
 * @param kg - Weight in kilograms (the canonical stored unit)
 * @param unit - Unit to display in
 * @returns Formatted string like "60" or "132.3", or `''` if `kg` is null/undefined
 */
export function formatWeight(kg: number | null | undefined, unit: WeightUnit): string {
  const converted = fromKg(kg, unit)
  if (converted === null) return ''
  const rounded = Math.round(converted * 10) / 10
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
}
