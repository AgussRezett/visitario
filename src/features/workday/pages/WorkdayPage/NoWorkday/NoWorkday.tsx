import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, ChevronRight, History } from 'lucide-react'
import { formatLongDate, formatShortWeekday, todayInArgentina, weekOf } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Skeleton } from '@/ui/Skeleton'
import type { WorkContext } from '@/features/workday/context'
import { historyQuery, resumableQuery } from '@/features/workday/api/queries'
import { useOpenWorkday } from '@/features/workday/api/mutations'
import { ResumeSheet } from '../ResumeSheet'
import { DayHeader } from '../DayHeader'
import styles from './NoWorkday.module.scss'

interface NoWorkdayProps {
  ctx: WorkContext
  date: string
  onOpen: (date: string) => void
}

function copy(date: string, personal: boolean) {
  const today = todayInArgentina()
  const title = date === today ? 'Hoy todavía no tenés jornada' : date < today ? 'No tuviste jornada este día' : 'Todavía no hay jornada para este día'
  const lead = personal
    ? 'Abrila y agregá las direcciones que vas a visitar. Después cargás cada visita con sus fotos y te queda el informe listo.'
    : 'Tu supervisor todavía no publicó locales para este día. Podés armar tu propia jornada: la ve igual que las que asigna.'
  const action = date === today ? 'Abrir mi jornada de hoy' : `Abrir jornada del ${formatShortWeekday(date).toLowerCase()}`
  return { title, lead, action }
}

/** No workday for the date: open one in a tap, resume what was left, see the week (wireframes A03 / AD03). */
export function NoWorkday({ ctx, date, onOpen }: NoWorkdayProps) {
  const [picking, setPicking] = useState(false)
  const [otherDate, setOtherDate] = useState(date)
  const [resuming, setResuming] = useState(false)
  const history = useQuery(historyQuery(ctx.companyId, ctx.personId))
  const resumable = useQuery(resumableQuery(ctx.companyId, date))
  const open = useOpenWorkday()
  const pending = resumable.data ?? []
  const text = copy(date, ctx.personal)

  const openOn = async (d: string) => {
    await open.mutateAsync({ companyId: ctx.companyId, date: d })
    onOpen(d)
  }

  const week = weekOf(date)
  const thisWeek = (history.data ?? []).filter((d) => week.includes(d.workDate))
  const recent = (history.data ?? []).slice(0, 5)

  return (
    <>
      <DayHeader ctx={ctx} date={date} days={history.data ?? []} onDateChange={onOpen} />

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.start}>
            <span className={styles.startIcon}><CalendarPlus size={28} aria-hidden /></span>
            <h2 className={styles.title}>{text.title}</h2>
            <p className={styles.lead}>{text.lead}</p>
            <div className={styles.actions}>
              <Button onClick={() => openOn(date)} loading={open.isPending && !picking} className={styles.primary}>{text.action}</Button>
              {!picking ? (
                <Button variant="ghost" size="md" onClick={() => setPicking(true)}>Elegir otra fecha</Button>
              ) : null}
            </div>
            {picking ? (
              <form
                className={styles.pick}
                onSubmit={(e) => {
                  e.preventDefault()
                  void openOn(otherDate)
                }}
              >
                <Field label="Fecha" type="date" value={otherDate} onChange={(e) => setOtherDate(e.target.value)} required />
                <Button type="submit" variant="secondary" size="md" loading={open.isPending}>Abrir</Button>
              </form>
            ) : null}
            {open.error ? <Banner tone="error">{open.error.message}</Banner> : null}
          </section>

          {pending.length ? (
            <section className={styles.pending} aria-label="Pendientes de días anteriores">
              <div className={styles.pendingHead}>
                <span className={styles.pendingIcon}><History size={20} aria-hidden /></span>
                <div>
                  <h2 className={styles.sectionTitle}>Quedaron {pending.length} de días anteriores</h2>
                  <p className={styles.small}>Sumalos a esta jornada; las exhibiciones sin acomodar vienen con ellos.</p>
                </div>
              </div>
              <ul className={styles.pendingList}>
                {pending.slice(0, 4).map((v) => (
                  <li key={v.visit_id}>
                    <span className={styles.itemName}>{v.store_name ?? v.address}</span>
                    <span className={styles.itemMeta}>
                      {formatShortWeekday(v.work_date)} · {v.work_status === 'closed' ? 'estaba cerrado' : 'pendiente'}
                      {v.pending_displays ? ` · ${v.pending_displays} exhib. sin acomodar` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" size="md" onClick={() => setResuming(true)}>
                Elegir cuáles retomar
              </Button>
            </section>
          ) : null}
        </div>

        <aside className={styles.aside} aria-label="Tu semana">
          <section className={styles.week}>
            <h2 className={styles.sectionTitle}>Tu semana</h2>
            <dl className={styles.weekStats}>
              <div><dt>días trabajados</dt><dd>{thisWeek.length}</dd></div>
              <div><dt>locales con resultado</dt><dd>{thisWeek.reduce((n, d) => n + d.visited, 0)}</dd></div>
              <div><dt>quedaron pendientes</dt><dd>{thisWeek.reduce((n, d) => n + d.pending, 0)}</dd></div>
            </dl>
          </section>

          <section className={styles.recent}>
            <h2 className={styles.sectionTitle}>Últimas jornadas</h2>
            {history.isPending ? (
              <div className={styles.recentSkeleton}>{[0, 1, 2].map((i) => <Skeleton key={i} height={44} />)}</div>
            ) : recent.length ? (
              <ul className={styles.days}>
                {recent.map((d) => (
                  <li key={d.id}>
                    <button type="button" className={styles.dayRow} onClick={() => onOpen(d.workDate)}>
                      <span className={styles.dayText}>
                        <span className={styles.dayName}>{formatLongDate(d.workDate)}</span>
                        <span className={styles.dayBar} aria-hidden><i style={{ width: `${d.total ? (d.visited / d.total) * 100 : 0}%` }} /></span>
                        <span className={styles.itemMeta}>{d.visited} de {d.total} con resultado{d.pending ? ` · ${d.pending} pendientes` : ''}</span>
                      </span>
                      <ChevronRight size={18} aria-hidden className={styles.chevron} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.small}>Cuando trabajes tus primeras jornadas las vas a ver acá.</p>
            )}
          </section>
        </aside>
      </div>

      <ResumeSheet
        open={resuming}
        onClose={() => setResuming(false)}
        ctx={ctx}
        date={date}
        visits={pending}
        onDone={() => {
          setResuming(false)
          onOpen(date)
        }}
      />
    </>
  )
}
