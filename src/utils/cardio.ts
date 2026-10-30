import type { CardioSession, CardioType } from '@/types'

export type DistanceUnit = 'km' | 'mi'

const KM_PER_MI = 1.609344

/**
 * How each cardio type is usually measured: `pace` is time per distance (`paceMeters`
 * sets the distance — 1000 means per km/mi, 500 per 500 m for rowing, 100 per 100 m for
 * swimming), `speed` is distance per hour, and `none` shows neither.
 */
interface CardioTypeInfo {
  label: string
  measure: 'pace' | 'speed' | 'none'
  /** For `pace` measured in a fixed metric split rather than per km/mi. */
  paceMeters?: number
}

export const CARDIO_TYPES: Record<CardioType, CardioTypeInfo> = {
  run: { label: 'Run', measure: 'pace' },
  walk: { label: 'Walk', measure: 'pace' },
  hike: { label: 'Hike', measure: 'pace' },
  cycle: { label: 'Cycle', measure: 'speed' },
  row: { label: 'Row', measure: 'pace', paceMeters: 500 },
  swim: { label: 'Swim', measure: 'pace', paceMeters: 100 },
  elliptical: { label: 'Elliptical', measure: 'none' },
  stairs: { label: 'Stair climber', measure: 'none' },
  hiit: { label: 'HIIT', measure: 'none' },
  other: { label: 'Other', measure: 'none' },
}

export const CARDIO_TYPE_ORDER = Object.keys(CARDIO_TYPES) as CardioType[]

export function kmToDistance(km: number, unit: DistanceUnit): number {
  return unit === 'mi' ? km / KM_PER_MI : km
}

export function distanceToKm(value: number, unit: DistanceUnit): number {
  return unit === 'mi' ? value * KM_PER_MI : value
}

/** "5.2 km" / "3.23 mi"; two decimals under 10, one above. */
export function formatDistance(km: number, unit: DistanceUnit): string {
  const value = kmToDistance(km, unit)
  const rounded = value < 10 ? Math.round(value * 100) / 100 : Math.round(value * 10) / 10
  return `${rounded} ${unit}`
}

/** "45:00" under an hour, "1:05:30" from an hour up. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** "2h 5m" / "45m" — for totals, where seconds are noise. */
export function formatTotalTime(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/**
 * The usual pace or speed for a session, e.g. "5:12 /km", "28.4 km/h", "2:05 /500m",
 * or null when it has no distance or its type isn't measured that way.
 */
export function formatPace(session: Pick<CardioSession, 'type' | 'durationSeconds' | 'distanceKm'>, unit: DistanceUnit): string | null {
  const info = CARDIO_TYPES[session.type]
  if (!session.distanceKm || session.distanceKm <= 0 || session.durationSeconds <= 0 || info.measure === 'none') return null

  if (info.measure === 'speed') {
    const perHour = kmToDistance(session.distanceKm, unit) / (session.durationSeconds / 3600)
    return `${Math.round(perHour * 10) / 10} ${unit === 'mi' ? 'mph' : 'km/h'}`
  }

  if (info.paceMeters) {
    const secondsPerSplit = session.durationSeconds / ((session.distanceKm * 1000) / info.paceMeters)
    return `${formatDuration(secondsPerSplit)} /${info.paceMeters}m`
  }

  const secondsPerUnit = session.durationSeconds / kmToDistance(session.distanceKm, unit)
  return `${formatDuration(secondsPerUnit)} /${unit}`
}

export interface CardioTotals {
  sessions: number
  durationSeconds: number
  distanceKm: number
}

/** Totals over sessions dated within [startDate, endDate], both YYYY-MM-DD and inclusive. */
export function cardioTotals(sessions: CardioSession[], startDate: string, endDate: string): CardioTotals {
  const inRange = sessions.filter((s) => s.date >= startDate && s.date <= endDate)
  return {
    sessions: inRange.length,
    durationSeconds: inRange.reduce((sum, s) => sum + s.durationSeconds, 0),
    distanceKm: inRange.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0),
  }
}

/** Newest first: by date, then by when it was logged. */
export function sortCardioNewestFirst(sessions: CardioSession[]): CardioSession[] {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
}
