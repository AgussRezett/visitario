import { formatLongDate } from '@/domain/dates'
import type { UnderstoodBrief } from '@/domain/brief'
import { Banner } from '@/ui/Banner'
import styles from './BriefSummary.module.scss'

interface BriefSummaryProps {
  brief: UnderstoodBrief
  /** The day being filled, when it is not chosen from the brief: said if the indications name another. */
  day?: string
}

/** What was read from the PDF and the indications, to check before adding. */
export function BriefSummary({ brief, day }: BriefSummaryProps) {
  const otherDay = day && brief.date && brief.date !== day ? brief.date : null
  return (
    <>
      <Banner tone="info" title="Revisá lo que leímos contra el PDF">
        <ul className={styles.chips} aria-label="Lo que entendimos">
          {brief.chips.map((c) => <li key={c} className={styles.chip}>{c}</li>)}
        </ul>
        {brief.task ? <p className={styles.task}>En cada local: <b>{brief.task}</b>. La tarea dice en qué página del PDF mirar.</p> : null}
      </Banner>
      {otherDay ? <Banner tone="warn">Las indicaciones hablan del {formatLongDate(otherDay).toLowerCase()} y estás armando el {formatLongDate(day ?? '').toLowerCase()}.</Banner> : null}
      {brief.unknown.length ? <Banner tone="warn">No encontramos {brief.unknown.join(', ')}: esos locales van sin vendedor. Si falta, se carga en Catálogos.</Banner> : null}
      {brief.conflicts.length ? (
        <Banner tone="warn" title="Un mismo número en dos direcciones">
          <p>Lo dejamos en la primera; revisá cuál es el correcto: {brief.conflicts.join('; ')}.</p>
        </Banner>
      ) : null}
      {brief.dropped ? (
        <Banner tone="warn">{brief.dropped === 1 ? 'Una dirección no está escrita así en el PDF: la dejamos afuera.' : `${brief.dropped} direcciones no están escritas así en el PDF: las dejamos afuera.`} Sumalas a mano si van.</Banner>
      ) : null}
    </>
  )
}
