import { BarChart3, Building2, CalendarDays, FileText, Inbox, LayoutGrid, MapPin, MapPinned, Megaphone, MessageSquareText, Route, Store, Tags, Users, type LucideIcon } from 'lucide-react'
import type { Role } from '@/domain/roles'

export interface Section {
  slug: string
  label: string
  title: string
  icon: LucideIcon
  stage: number
  summary: string
  /** On phones, goes under "Más" when there are more than 5 tabs. */
  more?: boolean
}

/** Every top-level section per role. Sections land stage by stage (see docs/plan.md). */
export const SECTIONS: Record<Role, Section[]> = {
  merchandiser: [
    { slug: 'workday', label: 'Jornada', title: 'Mi jornada', icon: MapPin, stage: 1, summary: 'Tus locales del día, en orden, con la ficha de cada visita.' },
    { slug: 'route', label: 'Recorrido', title: 'Recorrido', icon: Route, stage: 6, summary: 'El mejor orden para visitar tus locales, en auto o a pie.' },
    { slug: 'report', label: 'Informe', title: 'Informe del día', icon: FileText, stage: 1, summary: 'El resumen del día listo para copiar si te lo piden por WhatsApp.' },
  ],
  seller: [
    { slug: 'clients', label: 'Clientes', title: 'Mis clientes', icon: Store, stage: 7, summary: 'Tus clientes con su canal y la última activación.' },
    { slug: 'map', label: 'Mapa', title: 'Mapa de clientes', icon: MapPinned, stage: 7, summary: 'Los puntos de venta en el mapa, por vendedor, última visita, canal o trato.' },
  ],
  supervisor: [
    { slug: 'today', label: 'Hoy', title: 'Hoy en el equipo', icon: LayoutGrid, stage: 3, summary: 'El avance de cada activador, alertas y lo que falta revisar.' },
    { slug: 'review', label: 'Revisión', title: 'Revisión', icon: Inbox, stage: 3, summary: 'Aprobar visitas o pedir correcciones con un comentario.' },
    { slug: 'assign', label: 'Asignar', title: 'Asignar jornadas', icon: CalendarDays, stage: 3, summary: 'Armar y publicar la jornada de cada activador.' },
    { slug: 'stores', label: 'Directorio', title: 'Directorio', icon: Store, stage: 5, summary: 'Los comercios de la empresa con su historial de visitas.' },
    { slug: 'issues', label: 'Novedades', title: 'Novedades', icon: Megaphone, stage: 7, summary: 'Lo que los activadores vieron en los locales: pedidos, falta de stock, precios.', more: true },
    { slug: 'map', label: 'Mapa', title: 'Mapa de puntos', icon: MapPinned, stage: 7, summary: 'Los puntos de venta en el mapa, por vendedor, última visita, canal o trato.', more: true },
    { slug: 'reports', label: 'Reportes', title: 'Reportes', icon: BarChart3, stage: 6, summary: 'El período en números: tendencias, activadores, cobertura y estimados; y los informes del día.', more: true },
  ],
  admin: [
    { slug: 'users', label: 'Usuarios', title: 'Usuarios y equipos', icon: Users, stage: 5, summary: 'Altas por DNI, roles y equipos.' },
    { slug: 'catalogs', label: 'Catálogos', title: 'Catálogos', icon: Tags, stage: 5, summary: 'Marcas, tipos de exhibición y números de trabajo.' },
    { slug: 'templates', label: 'Plantillas', title: 'Plantillas de mensajes', icon: MessageSquareText, stage: 5, summary: 'Los mensajes ANTES, DESPUÉS y el informe.', more: true },
    { slug: 'company', label: 'Empresa', title: 'Empresa y plan', icon: Building2, stage: 5, summary: 'Datos de la empresa, plan y facturación.', more: true },
    { slug: 'stores', label: 'Directorio', title: 'Directorio', icon: Store, stage: 5, summary: 'Los comercios de la empresa con su historial de visitas.' },
    { slug: 'map', label: 'Mapa', title: 'Mapa de puntos', icon: MapPinned, stage: 7, summary: 'Los puntos de venta en el mapa, por vendedor, última visita, canal o trato.' },
    { slug: 'reports', label: 'Reportes', title: 'Reportes', icon: BarChart3, stage: 6, summary: 'El período en números: tendencias, activadores, cobertura y estimados.', more: true },
  ],
}

/** Phones show at most 5 tabs: when there are more, 4 stay and the rest go under "Más". */
export const MAX_TABS = 5

export function splitTabs<T extends { more?: boolean }>(items: readonly T[]): { tabs: T[]; more: T[] } {
  if (items.length <= MAX_TABS) return { tabs: [...items], more: [] }
  const ordered = [...items.filter((s) => !s.more), ...items.filter((s) => s.more)]
  return { tabs: ordered.slice(0, MAX_TABS - 1), more: ordered.slice(MAX_TABS - 1) }
}

export function findSection(slug: string): Section | undefined {
  return Object.values(SECTIONS).flat().find((s) => s.slug === slug)
}
