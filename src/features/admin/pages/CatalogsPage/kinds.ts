import type { CatalogKind } from '@/features/admin/api/catalogs'

/** How each catalog reads in Spanish, and what its second field is. */
export const KINDS: Record<CatalogKind, { title: string; one: string; fresh: string; extra?: { label: string; placeholder: string; help: string; empty: string } }> = {
  brand: {
    title: 'Marcas',
    one: 'marca',
    fresh: 'Nueva marca',
    extra: { label: 'Grupo', placeholder: 'Ej.: Grupo Campari', help: 'Opcional: para agruparlas en la ficha.', empty: '' },
  },
  display_type: { title: 'Tipos de exhibición', one: 'tipo de exhibición', fresh: 'Nuevo tipo de exhibición' },
  work_metric: {
    title: 'Números de trabajo',
    one: 'número de trabajo',
    fresh: 'Nuevo número de trabajo',
    extra: { label: 'En el informe', placeholder: 'Ej.: CUANTOS KIT DE BOLSAS ARME', help: 'La línea del informe del día. Vacío: no sale en el informe.', empty: 'No sale en el informe' },
  },
}
