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

/** Replaces {placeholders}; unknown or empty ones become empty and empty lines are tidied. */
export function fillTemplate(body: string, values: Record<string, string | number | null | undefined>) {
  return body
    .replace(/\{([a-z_]+)\}/g, (_, key: string) => {
      const v = values[key]
      return v === null || v === undefined ? '' : String(v)
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
