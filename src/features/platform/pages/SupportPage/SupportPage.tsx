import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { formatDayMonth, formatShortWeekday, formatTime, todayInArgentina } from '@/domain/dates'
import { STATUS_LABEL, lastSeen, rolesLabel } from '@/domain/people'
import type { SupportMember } from '@/domain/platform'
import { Banner } from '@/ui/Banner'
import { buttonClass } from '@/ui/Button'
import { Skeleton } from '@/ui/Skeleton'
import { supportQuery } from '@/features/platform/api'
import styles from './SupportPage.module.scss'

const when = (iso: string) => `${formatDayMonth(todayInArgentina(new Date(iso)))} · ${formatTime(iso)}`

function syncLine(m: SupportMember, now: Date) {
  if (m.syncReportedAt === null) return 'Sin datos de sincronización'
  const left = (m.syncPending ?? 0) + (m.syncFailed ?? 0)
  const state = m.syncFailed ? `${m.syncFailed} con error` : left ? `${left} sin enviar` : 'todo enviado'
  return `${state} · avisó ${lastSeen(m.syncReportedAt, now)}`
}

/** A company as support sees it: who is in it, what they did lately, nothing to change. */
export function SupportPage({ companyId }: { companyId: string }) {
  const look = useQuery(supportQuery(companyId))
  const now = new Date()
  const s = look.data

  return (
    <div className={styles.page}>
      <Link to="/platform" className={styles.back}><ArrowLeft size={18} aria-hidden />Empresas</Link>
      <header className={styles.titles}>
        <span className={styles.eyebrow}>Soporte · solo lectura</span>
        <h1 className={styles.title}>{s?.name ?? 'Empresa'}</h1>
      </header>

      {look.isPending ? (
        <Skeleton height={320} />
      ) : look.isError ? (
        <>
          <Banner tone="warn" title="No hay una sesión de soporte abierta">{look.error.message}</Banner>
          <Link to="/platform" className={buttonClass('secondary', 'md', styles.again)}><KeyRound size={18} aria-hidden />Abrir una desde Empresas</Link>
        </>
      ) : s ? (
        <>
          <Banner tone="info" icon={<KeyRound size={18} aria-hidden />}>
            Ves esta empresa en modo soporte: no se puede cambiar nada desde acá y la empresa ve que entraste.
          </Banner>

          <div className={styles.grid}>
            <section className={styles.card} aria-labelledby="people-title">
              <h2 id="people-title" className={styles.heading}>Personas · {s.members.length}</h2>
              <ul className={styles.rows}>
                {s.members.map((m, i) => (
                  <li key={`${m.name}-${i}`} className={styles.row}>
                    <span className={styles.main}>
                      <span className={styles.name}>{m.name}</span>
                      <span className={styles.meta}>{[rolesLabel(m.roles), m.team].filter(Boolean).join(' · ')}</span>
                      <span className={styles.meta}>
                        {m.status === 'active' ? `Última visita: ${m.lastVisitAt ? lastSeen(m.lastVisitAt, now) : 'ninguna'} · ${syncLine(m, now)}` : STATUS_LABEL[m.status]}
                      </span>
                    </span>
                    <span className={styles.chip} data-tone={m.syncFailed ? 'warn' : m.status === 'active' ? 'done' : 'muted'}>
                      {m.syncFailed ? 'Error al enviar' : m.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <div className={styles.side}>
              <section className={styles.card} aria-labelledby="days-title">
                <h2 id="days-title" className={styles.heading}>Últimos 14 días</h2>
                {s.days.length ? (
                  <ul className={styles.rows}>
                    {s.days.map((d) => (
                      <li key={d.date} className={styles.day}>
                        <span className={styles.name}>{formatShortWeekday(d.date)}</span>
                        <span className={styles.meta}>{d.finished} de {d.visits} terminadas · {d.approved} aprobadas · {d.photos} fotos</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className={styles.meta}>Sin visitas en estos días.</p>}
              </section>

              <section className={styles.card} aria-labelledby="setup-title">
                <h2 id="setup-title" className={styles.heading}>Configuración</h2>
                <dl className={styles.facts}>
                  <div><dt>Equipos</dt><dd>{s.teams.length ? s.teams.join(', ') : 'Ninguno'}</dd></div>
                  <div><dt>Marcas</dt><dd>{s.catalogs.brands}</dd></div>
                  <div><dt>Tipos de exhibición</dt><dd>{s.catalogs.displayTypes}</dd></div>
                  <div><dt>Comercios</dt><dd>{s.catalogs.stores}</dd></div>
                </dl>
              </section>

              <section className={styles.card} aria-labelledby="log-title">
                <h2 id="log-title" className={styles.heading}>Accesos de soporte</h2>
                <ul className={styles.rows}>
                  {s.sessions.map((a) => (
                    <li key={a.startsAt} className={styles.day}>
                      <span className={styles.name}>{a.reason}</span>
                      <span className={styles.meta}>{a.by} · {when(a.startsAt)} a {formatTime(a.endsAt)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
