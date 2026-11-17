import { CalendarPlus, X } from 'lucide-react'
import { reasonsFor } from '@/domain/route-plan'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Select } from '@/ui/Select'
import type { PlannedRoute } from '@/features/routeplan/order'
import styles from './PlanResult.module.scss'

interface PlanResultProps {
  plan: PlannedRoute
  today: string
  onRemove: (id: string) => void
  people: { personId: string; firstName: string; lastName: string }[]
  personId: string
  onPerson: (id: string) => void
  dayLabel: string
  onAdd: () => void
  adding: boolean
  added: string | null
  error: string | null
}

const kmText = (km: number) => `${km.toLocaleString('es-AR', { maximumFractionDigits: 1 })} km`

/** The route chosen: totals, each stop with why it is there, and into whose day. */
export function PlanResult({ plan, today, onRemove, people, personId, onPerson, dayLabel, onAdd, adding, added, error }: PlanResultProps) {
  const who = people.find((p) => p.personId === personId)
  return (
    <section className={styles.result} aria-label="Recorrido propuesto">
      <p className={styles.totals}>
        <b>{plan.stops.length} locales</b> · {kmText(plan.km)}{plan.minutes !== null ? ` · ${plan.minutes} min de traslado` : ' en línea recta'}
      </p>
      <ol className={styles.stops}>
        {plan.stops.map((s, i) => (
          <li key={s.id} className={styles.stop}>
            <span className={styles.n} aria-hidden>{i + 1}</span>
            <span className={styles.what}>
              <span className={styles.place}>{s.name ? `${s.name} · ` : ''}{s.address}{s.area ? `, ${s.area}` : ''}</span>
              <span className={styles.why}>{reasonsFor(s, today).join(' · ')}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => onRemove(s.id)} aria-label={`Sacar ${s.address} del recorrido`}><X size={18} aria-hidden /></Button>
          </li>
        ))}
      </ol>
      <div className={styles.assign}>
        <Select label="Para" value={personId} onChange={onPerson} placeholder="Elegí el activador"
          options={people.map((p) => ({ value: p.personId, label: `${p.firstName} ${p.lastName}` }))} />
        <Button size="lg" onClick={onAdd} disabled={!who || plan.stops.length < 1} loading={adding}>
          <CalendarPlus size={20} aria-hidden />{who ? `Agregar a la jornada de ${who.firstName}` : 'Agregar a la jornada'}
        </Button>
      </div>
      <p className={styles.help}>Va al borrador del {dayLabel}, en este orden. Lo publicás desde Asignar.</p>
      {added ? <Banner tone="ok">{added}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </section>
  )
}
