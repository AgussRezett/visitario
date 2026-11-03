import { SECTIONS } from './sections'

/** Where a page was opened from (?from=), only if it is a path inside Visitario. */
export const safeFrom = (v: unknown): string | undefined =>
  typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : undefined

/** The search a page with a way back accepts. */
export const fromSearch = (search: Record<string, unknown>): { from?: string } => {
  const from = safeFrom(search.from)
  return from ? { from } : {}
}

/** What the way back says, from where it goes: "Hoy en el equipo", "La jornada", "Revisión"… */
export function backLabel(path: string): string {
  const p = path.split('?')[0] ?? ''
  if (/^\/s\/today\/[^/]+/.test(p)) return 'La jornada'
  if (p.startsWith('/review/')) return 'Revisión'
  if (p.startsWith('/stores/')) return 'La ficha del local'
  if (p.startsWith('/visit/')) return 'La visita'
  const slug = /^\/s\/([^/]+)/.exec(p)?.[1]
  const section = Object.values(SECTIONS).flat().find((s) => s.slug === slug)
  return section?.title ?? 'Volver'
}
