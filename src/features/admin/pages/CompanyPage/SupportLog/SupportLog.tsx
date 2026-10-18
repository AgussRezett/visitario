import { useQuery } from '@tanstack/react-query'
import { formatDayMonth, formatTime, todayInArgentina } from '@/domain/dates'
import { supportLogQuery } from '@/features/admin/api/company'
import styles from './SupportLog.module.scss'

/** Who from Visitario looked at the company's data, when and why. Read only. */
export function SupportLog({ companyId, cardClass, headingClass, helpClass }: { companyId: string; cardClass?: string; headingClass?: string; helpClass?: string }) {
  const log = useQuery(supportLogQuery(companyId))
  const rows = log.data ?? []
  return (
    <section className={cardClass} aria-label="Accesos de soporte">
      <h2 className={headingClass}>Accesos de soporte</h2>
      {rows.length ? (
        <ul className={styles.list}>
          {rows.map((a) => (
            <li key={a.id} className={styles.row}>
              <span className={styles.reason}>{a.reason}</span>
              <span className={styles.when}>Equipo de Visitario · {formatDayMonth(todayInArgentina(new Date(a.startsAt)), true)}, {formatTime(a.startsAt)} a {formatTime(a.endsAt)}</span>
            </li>
          ))}
        </ul>
      ) : log.isSuccess ? (
        <p className={helpClass}>Nadie de Visitario entró a mirar los datos de la empresa.</p>
      ) : null}
      <p className={helpClass}>Si alguien de Visitario necesita mirar algo para ayudarte, entra en modo solo lectura y queda anotado acá con el motivo.</p>
    </section>
  )
}
