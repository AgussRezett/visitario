import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronRight, History } from 'lucide-react'
import { formatLongDate, formatShortWeekday, todayInArgentina } from '@/domain/dates'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Field } from '@/ui/Field'
import { Banner } from '@/ui/Banner'
import { Chip } from '@/ui/StatusChip'
import { Table } from '@/ui/Table'
import type { WorkContext } from '@/features/workday/context'
import { historyQuery, resumableQuery } from '@/features/workday/api/queries'
import { useOpenWorkday } from '@/features/workday/api/mutations'
import { ResumeSheet } from '../ResumeSheet'
import styles from './NoWorkday.module.scss'

interface NoWorkdayProps {
  ctx: WorkContext
  date: string
  onOpen: (date: string) => void
}

/** No workday for the date: resume pending visits or open your own day (wireframes A03 / AD03). */
export function NoWorkday({ ctx, date, onOpen }: NoWorkdayProps) {
  const isToday = date === todayInArgentina()
  const [openDate, setOpenDate] = useState(date)
  const [resuming, setResuming] = useState(false)
  const history = useQuery(historyQuery(ctx.companyId, ctx.personId))
  const resumable = useQuery(resumableQuery(ctx.companyId, date))
  const open = useOpenWorkday()
  const pending = resumable.data ?? []
  const pendingCount = pending.filter((v) => v.work_status === 'pending').length
  const closedCount = pending.length - pendingCount

  return (
    <>
      <div className={styles.head}>
        <span className={styles.eyebrow}>
          {formatLongDate(date)} · {ctx.companyName}
        </span>
        <h1 className={styles.title}>{isToday ? 'Hoy no tenés jornada asignada' : 'No tenés jornada ese día'}</h1>
      </div>
      <p className={styles.lead}>Tu supervisor todavía no cargó locales. Podés retomar lo pendiente o armar tu propia jornada.</p>

      <div className={styles.cards}>
        {pending.length ? (
          <button type="button" className={styles.resumeCard} onClick={() => setResuming(true)}>
            <span className={styles.resumeIcon}><History size={22} aria-hidden /></span>
            <span className={styles.cardText}>
              <span className={styles.cardTitle}>Retomar {pending.length} pendientes</span>
              <span className={styles.cardLead}>
                {[pendingCount && `${pendingCount} pendientes`, closedCount && `${closedCount} cerrados`].filter(Boolean).join(' y ')} de días anteriores
              </span>
            </span>
            <ChevronRight className={styles.chevron} size={20} aria-hidden />
          </button>
        ) : null}

        <Card className={styles.openCard}>
          <span className={styles.openIcon}><CalendarDays size={22} aria-hidden /></span>
          <span className={styles.cardTitle}>Abrir mi propia jornada</span>
          <form
            className={styles.openForm}
            onSubmit={async (e) => {
              e.preventDefault()
              await open.mutateAsync({ companyId: ctx.companyId, date: openDate })
              onOpen(openDate)
            }}
          >
            <Field label="Fecha" type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} required />
            <Button type="submit" size="md" loading={open.isPending} className={styles.openButton}>Abrir jornada</Button>
          </form>
          {open.error ? <Banner tone="error">{open.error.message}</Banner> : null}
          <p className={styles.help}>Si ya existe una jornada en esa fecha, se abre la existente. Tu supervisor la ve igual que las que asigna.</p>
        </Card>
      </div>

      {history.data?.length ? (
        <section className={styles.history}>
          <h2 className={styles.historyTitle}>Jornadas anteriores</h2>
          <ul className={styles.rows}>
            {history.data.map((d) => (
              <li key={d.id}>
                <button type="button" className={styles.row} onClick={() => onOpen(d.workDate)}>
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{formatLongDate(d.workDate)}</span>
                    <span className={styles.rowLead}>
                      {d.total} locales · {d.visited} con resultado{d.pending ? ` · ${d.pending} pendientes` : ''}
                    </span>
                  </span>
                  {d.pending ? <span className={styles.pendingPill}>{d.pending}</span> : <Chip tone="approved">Cerrada</Chip>}
                </button>
              </li>
            ))}
          </ul>
          <Table className={styles.desktopTable} label="Jornadas anteriores">
              <thead>
                <tr><th>Fecha</th><th>Locales</th><th>Con resultado</th><th>Pendientes</th><th /></tr>
              </thead>
              <tbody>
                {history.data.map((d) => (
                  <tr key={d.id}>
                    <td className={styles.strong}>{formatShortWeekday(d.workDate)}</td>
                    <td className={styles.num}>{d.total}</td>
                    <td className={styles.num}>{d.visited}</td>
                    <td>{d.pending ? <span className={styles.pendingPill}>{d.pending}</span> : <Chip tone="approved">Cerrada</Chip>}</td>
                    <td><Button variant="ghost" size="sm" onClick={() => onOpen(d.workDate)}>Ver</Button></td>
                  </tr>
                ))}
              </tbody>
          </Table>
        </section>
      ) : null}

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
