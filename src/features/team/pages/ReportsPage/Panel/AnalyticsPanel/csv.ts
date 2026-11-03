import type { DayPoint, PersonRow, Summary } from '@/domain/analytics'
import type { Range } from '@/domain/report-period'

/** Excel needs it to read the accents. */
const BOM = '\uFEFF'

const cell = (v: string | number | null) => {
  const s = v === null ? '' : String(v)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const line = (cells: (string | number | null)[]) => cells.map(cell).join(';')

interface Input {
  range: Range
  now: Summary
  points: DayPoint[]
  people: PersonRow[]
  names: Map<string, { first: string; last: string }>
  metrics: { id: number; name: string }[]
}

/** The panel as a spreadsheet: totals, each person and each day (";" opens right in Excel in Spanish). */
export function reportCsv({ range, now, points, people, names, metrics }: Input) {
  const rows = [
    line(['Visitario · Reporte', `${range.from} al ${range.to}`]),
    '',
    line(['Planificadas', 'Con resultado', 'Activadas', 'No autorizadas', 'Cerrados', 'Sin visitar', 'Exhibiciones acomodadas', 'Fotos', ...metrics.map((m) => m.name)]),
    line([now.planned, now.visited, now.done, now.refused, now.closed, now.pending, now.arranged, now.photos, ...metrics.map((m) => now.metrics[m.id] ?? 0)]),
    '',
    line(['Activador', 'Planificadas', 'Con resultado', 'Activadas', 'No autorizadas', 'Cerrados', 'Días', 'Por día', 'Minutos en el local (mediana)', 'Exhibiciones acomodadas', 'Extras', ...metrics.map((m) => m.name)]),
    ...people.map((r) => {
      const n = names.get(r.personId)
      return line([n ? `${n.first} ${n.last}` : r.personId, r.planned, r.visited, r.done, r.refused, r.closed, r.days, r.perDay === null ? null : r.perDay.toFixed(1).replace('.', ','), r.minutes === null ? null : Math.round(r.minutes), r.arranged, r.extras, ...metrics.map((m) => r.metrics[m.id] ?? 0)])
    }),
    '',
    line(['Fecha', 'Activadas', 'No autorizadas', 'Cerrados', 'Sin visitar', ...metrics.map((m) => m.name)]),
    ...points.map((p) => line([p.date, p.done, p.refused, p.closed, p.pending, ...metrics.map((m) => p.metrics[m.id] ?? 0)])),
  ]
  return `${BOM}${rows.join('\r\n')}`
}

export function downloadCsv(name: string, input: Input) {
  const url = URL.createObjectURL(new Blob([reportCsv(input)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
