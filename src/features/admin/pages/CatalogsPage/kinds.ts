import type { CatalogKind } from '@/features/admin/api/catalogs'

/** How each catalog reads in Spanish, and what its second field is. */
export const KINDS: Record<
  CatalogKind,
  {
    title: string
    one: string
    fresh: string
    fem?: boolean
    /** Under the title: what the list is for. */
    intro?: string
    /** Max length of the name. */
    max?: number
    extra?: { label: string; placeholder: string; help: string; empty: string; numeric?: boolean; readOnly?: boolean }
  }
> = {
  brand: {
    title: 'Marcas',
    one: 'marca',
    fresh: 'Nueva marca',
    fem: true,
    extra: { label: 'Grupo', placeholder: 'Ej.: Grupo Campari', help: 'Opcional: para agruparlas en la ficha.', empty: '' },
  },
  display_type: { title: 'Tipos de exhibición', one: 'tipo de exhibición', fresh: 'Nuevo tipo de exhibición' },
  channel: {
    title: 'Canales',
    one: 'canal',
    fresh: 'Nuevo canal',
    intro: 'El tipo de comercio. Sale en el directorio, la visita y los mensajes como {canal}.',
    max: 60,
    extra: { label: 'Número', placeholder: 'Ej.: 1', help: 'Opcional: el número con el que lo nombran (1. Autoservicio). Ordena la lista.', empty: 'Sin número', numeric: true },
  },
  seller: {
    title: 'Vendedores',
    one: 'vendedor',
    fresh: 'Nuevo vendedor',
    intro: 'Quién le vende a cada comercio: el responsable de los mensajes ({vendedor}). Al invitarlo con el rol Vendedor, elegí cuál es y se le une su usuario.',
    max: 80,
    extra: { label: 'Usuario', placeholder: '', help: '', empty: 'Sin usuario', readOnly: true },
  },
  work_metric: {
    title: 'Números de trabajo',
    one: 'número de trabajo',
    fresh: 'Nuevo número de trabajo',
    extra: { label: 'En el informe', placeholder: 'Ej.: CUANTOS KIT DE BOLSAS ARME', help: 'La línea del informe del día. Vacío: no sale en el informe.', empty: 'No sale en el informe' },
  },
}
