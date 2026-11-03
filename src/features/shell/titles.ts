import type { Role } from '@/domain/roles'
import { SECTIONS, findSection } from './sections'

/**
 * What the browser tab says for each address, so several open tabs read apart:
 * "Mapa de puntos · Visitario", "Directorio · Visitario", "Informes · Visitario".
 * Pages with something more precise (a store, a visit, a person's day) say it themselves.
 */
export function titleFor(pathname: string, role: Role | null = null): string | null {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/s/users/new') return 'Invitar a alguien'
  if (p.startsWith('/s/today/')) return 'Jornada del activador'
  if (p.startsWith('/s/clients/')) return 'Cliente'
  if (p === '/s/import') return 'Importar planilla'
  const slug = /^\/s\/([^/]+)/.exec(p)?.[1]
  if (slug) return (role ? SECTIONS[role].find((s) => s.slug === slug) : undefined)?.title ?? findSection(slug)?.title ?? null
  if (p.startsWith('/visit/')) return 'Visita'
  if (p.startsWith('/review/')) return 'Revisión'
  if (p.startsWith('/stores/')) return 'Comercio'
  if (p === '/profile') return 'Mi perfil'
  if (p.startsWith('/platform/')) return 'Empresa'
  if (p === '/platform') return 'Empresas'
  if (p === '/login') return 'Ingresar'
  if (p === '/signup') return 'Crear cuenta'
  if (p.startsWith('/invitacion/')) return 'Invitación'
  if (p === '/onboarding') return 'Primeros pasos'
  return null
}
