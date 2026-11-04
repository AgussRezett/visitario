// Filters of several values at once, the same everywhere (directory, map, reports).

/**
 * Whether a value passes a filter of several: none chosen means all; `none` stands for
 * "without one" (0 for "Sin canal", "Sin vendedor").
 */
export function matchesAny<T>(value: T | null | undefined, wanted: readonly T[], none: T): boolean {
  return wanted.length === 0 || wanted.includes(value ?? none)
}

/** Ids from a filter's strings (a MultiSelect gives strings). */
export const toIds = (values: readonly string[]) => values.map(Number).filter((n) => Number.isInteger(n) && n >= 0)
