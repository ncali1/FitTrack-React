/**
 * Guards the `prefers-reduced-motion` rule in index.css: every animation class the app
 * defines there must be stopped by it. happy-dom doesn't apply media queries or run CSS
 * animations, so this checks the stylesheet's text rather than rendered behaviour.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve(import.meta.dirname, 'index.css'), 'utf8')

/** Class names of rules in index.css that start an animation. */
const animatedClasses = [...css.matchAll(/^\s*\.([\w-]+)\s*\{[^}]*\banimation\s*:/gm)].map((match) => match[1]!)

/** The selector list of the reduced-motion rule. */
const reducedMotionSelectors = (() => {
  const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\{\s*animation:\s*none/.exec(css)
  return block ? block[1]!.split(',').map((selector) => selector.trim()) : []
})()

const isStoppedByReducedMotion = (className: string) =>
  reducedMotionSelectors.some((selector) => {
    const substring = /^\[class\*="(.+)"\]$/.exec(selector)
    return substring ? className.includes(substring[1]!) : selector === `.${className}`
  })

describe('index.css: reduced motion', () => {
  it('finds the animation classes and the reduced-motion rule to check', () => {
    expect(animatedClasses).toEqual(expect.arrayContaining(['animate-pop-in', 'anim-press', 'tilt3d-figure']))
    expect(reducedMotionSelectors.length).toBeGreaterThan(0)
  })

  // #15: animate-pop-in (every tab change) still played with reduced motion on.
  it('stops every animation the app defines when the user prefers reduced motion', () => {
    const missed = animatedClasses.filter((className) => !isStoppedByReducedMotion(className))
    expect(missed).toEqual([])
  })
})
