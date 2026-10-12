// Identity rules shared by forms and tests. The database enforces the same ones.

/** Strips dots and spaces: "34.567.890" -> "34567890". */
export function normalizeDni(input: string): string {
  return input.replace(/[.\s]/g, '')
}

export function isValidDni(input: string): boolean {
  return /^[0-9]{7,8}$/.test(normalizeDni(input))
}

/** "34567890" -> "34.567.890" for display. */
export function formatDni(dni: string): string {
  const digits = normalizeDni(dni)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Normalizes an Argentine mobile to E.164 (+54 9 ...).
 * Accepts "11 5555-4521", "011 15 5555 4521", "+54 9 11 5555 4521".
 * Returns null when it cannot be read as a mobile number.
 */
export function normalizeArPhone(input: string): string | null {
  let d = input.replace(/\D/g, '')
  if (d.startsWith('549')) d = d.slice(3)
  else if (d.startsWith('54')) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)
  // Drop the legacy "15" after the area code (2 to 4 digits).
  const match = /^(\d{2,4})15(\d{6,8})$/.exec(d)
  if (match && match[1] && match[2] && (match[1] + match[2]).length === 10) d = match[1] + match[2]
  if (d.length !== 10) return null
  return `+549${d}`
}

/** True when the date is a real past date at least 16 years ago. */
export function isPlausibleBirthDate(value: string, today = new Date()): boolean {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return false
  const limit = new Date(today)
  limit.setFullYear(limit.getFullYear() - 16)
  return date.getFullYear() >= 1900 && date <= limit
}
