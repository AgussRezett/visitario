// Pure helpers for the Select's list: which option is next, search and type-ahead.
import type { ReactNode } from 'react'

export interface SelectOption {
  value: string | number
  label: string
  /** Options with the same group are shown together under its name. */
  group?: string
  /** What the button shows once chosen, when it differs from the list (adds the group, say). */
  selectedLabel?: string
  /** Before the label, in the list and on the button: a person's photo, say. */
  leading?: ReactNode
  /** A second, quieter line. */
  hint?: string
  disabled?: boolean
}

export const normalize = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** The options whose label (or hint) has every word typed, in any order. */
export function filterOptions(options: readonly SelectOption[], query: string): SelectOption[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (!words.length) return [...options]
  return options.filter((o) => {
    const text = normalize(`${o.label} ${o.hint ?? ''} ${o.group ?? ''}`)
    return words.every((w) => text.includes(w))
  })
}

/** The next enabled option going `delta` steps from `from` (-1: none yet); stays at the ends. */
export function step(options: readonly SelectOption[], from: number, delta: 1 | -1): number {
  for (let i = from + delta; i >= 0 && i < options.length; i += delta) {
    if (!options[i]?.disabled) return i
  }
  return from >= 0 && from < options.length ? from : edge(options, delta === 1 ? 'first' : 'last')
}

/** The first or last enabled option, or -1. */
export function edge(options: readonly SelectOption[], which: 'first' | 'last'): number {
  const order = options.map((_, i) => i)
  if (which === 'last') order.reverse()
  return order.find((i) => !options[i]?.disabled) ?? -1
}

/**
 * Type-ahead: the next enabled option (after `from`, wrapping) whose label starts with
 * what was typed. Typing the same letter again moves through the ones that start with it.
 */
export function typeahead(options: readonly SelectOption[], from: number, typed: string): number {
  const text = normalize(typed)
  if (!text) return from
  const same = [...text].every((c) => c === text[0])
  const wanted = same ? text[0] ?? '' : text
  const start = same ? from + 1 : Math.max(from, 0)
  for (let k = 0; k < options.length; k++) {
    const i = (start + k) % options.length
    const o = options[i]
    if (o && !o.disabled && normalize(o.label).startsWith(wanted)) return i
  }
  return from
}

/** Where the dropdown goes on desktop: under the trigger, or above it when there is no room. */
export interface Placement { left: number; width: number; maxHeight: number; top?: number; bottom?: number }

export function placeBelowOrAbove(trigger: { top: number; bottom: number; left: number; width: number }, viewport: { width: number; height: number }, panelHeight: number): Placement {
  const gap = 6
  const margin = 8
  const below = viewport.height - trigger.bottom - gap - margin
  const above = trigger.top - gap - margin
  const up = below < Math.min(panelHeight, 240) && above > below
  const width = Math.min(Math.max(trigger.width, 220), viewport.width - margin * 2)
  const left = Math.min(Math.max(trigger.left, margin), viewport.width - width - margin)
  return {
    left,
    width,
    maxHeight: Math.max(160, Math.min(360, up ? above : below)),
    ...(up ? { bottom: viewport.height - trigger.top + gap } : { top: trigger.bottom + gap }),
  }
}
