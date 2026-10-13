/** Search-param helpers for routes: unknown or malformed values are dropped. */
export const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
export const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined)
export const oneOf = <T extends string>(values: readonly T[]) => (v: unknown) => (typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : undefined)
export const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined)
