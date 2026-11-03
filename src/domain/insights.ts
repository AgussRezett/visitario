import type { Coverage, PersonRow, Slice, Summary } from './analytics'
import type { Projection } from './forecast'

// "Lectura rápida": the few sentences a manager would say looking at the panel.

export interface Insight {
  tone: 'good' | 'bad' | 'info'
  text: string
}

const p = (n: number) => `${Math.round(n * 100)} %`
const DAYS = ['los lunes', 'los martes', 'los miércoles', 'los jueves', 'los viernes', 'los sábados', 'los domingos']

interface Input {
  now: Summary
  before: Summary | null
  projection: Projection | null
  trend: number | null
  people: PersonRow[]
  names: (id: string) => string
  channels: Slice[]
  channelName: (key: string) => string
  coverage: Coverage
  heat: number[][]
}

/** At most six, most useful first; nothing when there is nothing to say. */
export function insights(i: Input): Insight[] {
  const out: Insight[] = []
  const { now, before } = i
  if (!now.planned) return out

  if (before && before.visited > 0) {
    const d = (now.visited - before.visited) / before.visited
    if (Math.abs(d) >= 0.05) out.push({ tone: d > 0 ? 'good' : 'bad', text: `Las visitas con resultado ${d > 0 ? 'subieron' : 'bajaron'} ${p(Math.abs(d))} frente al período anterior (${now.visited} contra ${before.visited}).` })
  }
  if (i.projection) {
    out.push({ tone: 'info', text: `Al ritmo actual (${i.projection.rate.toFixed(1).replace('.', ',')} por día hábil) el período cierra con unas ${i.projection.projected} visitas, entre ${i.projection.low} y ${i.projection.high}.` })
  } else if (i.trend !== null && Math.abs(i.trend) >= 0.05) {
    out.push({ tone: i.trend > 0 ? 'good' : 'bad', text: `La tendencia es ${i.trend > 0 ? 'de suba' : 'de baja'}: ${p(Math.abs(i.trend))} por semana.` })
  }
  if (now.visited >= 10 && now.refused / now.visited >= 0.1) {
    const worst = i.channels.filter((c) => c.visited >= 5).sort((a, b) => b.refused / b.visited - a.refused / a.visited)[0]
    out.push({ tone: 'bad', text: `${p(now.refused / now.visited)} de las visitas no fueron autorizadas${worst && worst.refused ? `; el canal con más es ${i.channelName(worst.key)} (${p(worst.refused / worst.visited)})` : ''}.` })
  }
  const late = (i.coverage.buckets[3]?.count ?? 0) + (i.coverage.buckets[4]?.count ?? 0)
  if (late > 0 && i.coverage.active) out.push({ tone: 'bad', text: `${late === 1 ? '1 comercio del directorio lleva' : `${late} comercios del directorio llevan`} más de 30 días sin visita o nunca ${late === 1 ? 'la tuvo' : 'la tuvieron'} (${p(late / i.coverage.active)}).` })
  const busy = i.people.filter((r) => r.perDay !== null && r.days >= 2)
  if (busy.length >= 2) {
    const top = busy.reduce((a, b) => ((b.perDay ?? 0) > (a.perDay ?? 0) ? b : a))
    out.push({ tone: 'good', text: `${i.names(top.personId)} es quien más visitas resuelve por día (${(top.perDay ?? 0).toFixed(1).replace('.', ',')}).` })
  }
  const byDay = i.heat.map((row) => row.reduce((n, x) => n + x, 0))
  const best = byDay.indexOf(Math.max(...byDay))
  if (byDay[best]) out.push({ tone: 'info', text: `El día con más llegadas es ${DAYS[best]}.` })
  return out.slice(0, 6)
}
