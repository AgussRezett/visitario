import type { Summary } from '@/domain/analytics'
import type { Kpi } from '../KpiTiles'
import { minutesText, num, pct } from '../format'

const rate = (a: number, b: number) => (b ? a / b : null)

/** The eight figures on top of the panel, each with its value in the period before. */
export function kpisOf(now: Summary, before: Summary | null, coverage: number | null): Kpi[] {
  const perPersonDay = (s: Summary) => rate(s.visited, Math.max(s.people, 1) * Math.max(s.activeDays, 1))
  return [
    { label: 'Visitas con resultado', value: num(now.visited), now: now.visited, before: before?.visited, better: 'up', note: `${num(now.planned)} planificadas` },
    { label: 'Cumplimiento', value: pct(now.completion), now: now.completion, before: before?.completion ?? null, better: 'up', note: `${num(now.pending)} sin visitar` },
    { label: 'Activadas', value: num(now.done), now: now.done, before: before?.done, better: 'up', note: `${pct(now.effectiveness)} de las visitadas` },
    { label: 'No autorizadas', value: pct(rate(now.refused, now.visited)), now: rate(now.refused, now.visited), before: before ? rate(before.refused, before.visited) : null, better: 'down', note: `${num(now.refused)} visitas` },
    { label: 'Exhibiciones acomodadas', value: num(now.arranged), now: now.arranged, before: before?.arranged, better: 'up', note: now.displays ? `${pct(rate(now.arranged, now.displays))} de ${num(now.displays)}` : 'Sin exhibiciones indicadas' },
    { label: 'Comercios visitados', value: num(now.stores), now: now.stores, before: before?.stores, better: 'up', note: `${pct(coverage)} del directorio` },
    { label: 'Tiempo en el local', value: minutesText(now.minutes), now: now.minutes, before: before?.minutes ?? null, note: 'Mediana de las activadas' },
    { label: 'Por activador y día', value: perPersonDay(now) === null ? '—' : num(perPersonDay(now) ?? 0, 1), now: perPersonDay(now), before: before ? perPersonDay(before) : null, better: 'up', note: `${num(now.people)} activadores · ${num(now.extras)} extras` },
  ]
}
