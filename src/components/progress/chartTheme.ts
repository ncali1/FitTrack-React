import { Chart } from 'chart.js'

/**
 * Reads a colour token from index.css at render time — Chart.js draws to a canvas, so it
 * can't use Tailwind classes. Falls back to `fallback` where styles aren't loaded (tests).
 */
function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** Adds an alpha channel to a `#rrggbb` token so fills can sit under a line. */
function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return hex
  const n = parseInt(match[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/**
 * Shared "training log" chart styling: straight segments, square markers and mono tick
 * labels, so every chart reads like a plotted logbook column rather than a glossy dashboard.
 * Call inside the component (not at module load) so the CSS has been applied.
 */
export function chartTheme(series: 'accent' | 'mark' = 'accent') {
  const line = series === 'mark' ? token('--color-mark', '#ecd54a') : token('--color-accent', '#ff5b1f')
  const canvas = token('--color-canvas', '#0e0e0d')
  const ink = token('--color-ink', '#ece9e2')
  const muted = token('--color-ink-muted', '#a29e95')
  const border = token('--color-surface-border', '#2d2c28')
  const mono = token('--font-mono', 'ui-monospace, monospace')

  Chart.defaults.font.family = mono
  Chart.defaults.font.size = 10

  return {
    line,
    fill: withAlpha(line, 0.08),
    bar: line,
    point: {
      pointStyle: 'rect' as const,
      pointBackgroundColor: line,
      pointBorderColor: canvas,
      pointRadius: 3.5,
      pointHoverRadius: 5,
    },
    tension: 0,
    tooltip: {
      backgroundColor: canvas,
      titleColor: ink,
      bodyColor: ink,
      borderColor: border,
      borderWidth: 1,
      padding: 8,
      cornerRadius: 2,
    },
    grid: { color: withAlpha(token('--color-ink', '#ece9e2'), 0.07) },
    ticks: { color: muted },
  }
}
