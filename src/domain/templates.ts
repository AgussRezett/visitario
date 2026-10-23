import type { Enums } from '@/lib/supabase'

export type TemplateKind = Enums<'template_kind'>

/**
 * Used when a company has not written its own (e.g. self-employed).
 * Same placeholders as the company templates; user-facing text stays in Spanish.
 */
export const DEFAULT_TEMPLATES: Record<TemplateKind, string> = {
  before: '*ANTES\nFecha: {date}\nDirección: {address}\nComercio: {store_name}',
  after: '*DESPUÉS\nFecha: {date}\nDirección: {address}\nComercio: {store_name}\nObservación: {notes}',
  daily_report: 'RESUMEN DEL DIA {date}\nCUANTOS CLIENTES VISITE: {visited_count}\n{metrics}\n\nVisitados:\n{visited}\n\nNo visitados:\n{not_visited}\n\nExtras:\n{added}',
  visit_report: '{store_name} · {address}\nFecha: {date}\nTarea: {task}\nObservación: {notes}',
}

export interface TemplateField {
  /** What the admin types: {fecha}, {direccion}… */
  token: string
  /** The value it takes (English, as the code and the first templates use it). */
  key: string
  label: string
}

const VISIT_FIELDS: TemplateField[] = [
  { token: 'fecha', key: 'date', label: 'Fecha de la visita' },
  { token: 'fecha_corta', key: 'short_date', label: 'Fecha sin el año (19/10)' },
  { token: 'direccion', key: 'address', label: 'Dirección' },
  { token: 'nombre', key: 'store_name', label: 'Nombre del comercio' },
  { token: 'nro_cliente', key: 'customer_number', label: 'Número de cliente' },
  { token: 'zona', key: 'area', label: 'Zona' },
  { token: 'canal', key: 'channel', label: 'Canal del comercio' },
  { token: 'vendedor', key: 'seller', label: 'Vendedor (responsable)' },
  { token: 'tarea', key: 'task', label: 'Tarea' },
  { token: 'llegada', key: 'arrival', label: 'Hora de llegada' },
  { token: 'autorizacion', key: 'consent', label: 'Si autorizó' },
  { token: 'exhibiciones', key: 'displays', label: 'Exhibiciones' },
  { token: 'notas', key: 'notes', label: 'Observaciones' },
  { token: 'activador', key: 'merchandiser', label: 'Activador' },
]

/** What each template can show, in the admin's words. */
export const TEMPLATE_FIELDS: Record<TemplateKind, TemplateField[]> = {
  before: VISIT_FIELDS,
  after: VISIT_FIELDS,
  visit_report: VISIT_FIELDS,
  daily_report: [
    { token: 'fecha', key: 'date', label: 'Fecha del día' },
    { token: 'cantidad_visitados', key: 'visited_count', label: 'Cuántos visitó' },
    { token: 'numeros', key: 'metrics', label: 'Números de trabajo' },
    { token: 'por_canal', key: 'by_channel', label: 'Visitados por canal' },
    { token: 'visitados', key: 'visited', label: 'Lista de visitados' },
    { token: 'no_visitados', key: 'not_visited', label: 'Lista de no visitados' },
    { token: 'extras', key: 'added', label: 'Lista de extras' },
    { token: 'activador', key: 'merchandiser', label: 'Activador' },
  ],
}

const ALIASES: Record<string, string> = {
  ...Object.fromEntries(Object.values(TEMPLATE_FIELDS).flat().map((f) => [f.token, f.key])),
  // How the supervisors call the seller in their messages.
  responsable: 'seller',
}

type Values = Record<string, string | number | null | undefined>

/** What a missing piece of data says in a message: the line stays, so nobody wonders. */
export const MISSING = '-'

/** {canal} as stored, {CANAL} in capitals: the admin writes the data the way the message shows it. */
const valueOf = (values: Values, token: string) => {
  const key = token.toLowerCase()
  const v = values[key] ?? values[ALIASES[key] ?? '']
  const text = v === null || v === undefined ? '' : String(v).trim()
  if (!text) return MISSING
  return token !== key && token === token.toUpperCase() ? text.toLocaleUpperCase('es-AR') : text
}

const TOKEN = /\{([A-Za-z_]+)\}/g

/**
 * Replaces {placeholders}, in Spanish ({fecha}) or as the code names them ({date});
 * in capitals ({CANAL}) the value comes out in capitals. Every line of the template stays:
 * a piece of data that is missing shows as "-" ("RESPONSABLE: -").
 */
export function fillTemplate(body: string, values: Values) {
  return body
    .replace(TOKEN, (_, t: string) => valueOf(values, t))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Labels for one message per display: "Puntera", "Góndola 1", "Góndola 2"
 * (a type that repeats is numbered, in the visit's order).
 */
export function displayLabels(names: readonly string[]): string[] {
  const total = new Map<string, number>()
  for (const n of names) total.set(n, (total.get(n) ?? 0) + 1)
  const seen = new Map<string, number>()
  return names.map((n) => {
    const i = (seen.get(n) ?? 0) + 1
    seen.set(n, i)
    return (total.get(n) ?? 0) > 1 ? `${n} ${i}` : n
  })
}
