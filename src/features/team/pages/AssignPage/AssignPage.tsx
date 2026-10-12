import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CalendarPlus, Check, Copy, History, Plus, Send, X } from 'lucide-react'
import { addDays, formatDayMonth, formatLongDate, todayInArgentina } from '@/domain/dates'
import { planLabel, type TeamMember } from '@/domain/team'
import { initials } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Field } from '@/ui/Field'
import { Refreshing } from '@/ui/Refreshing'
import { Sheet } from '@/ui/Sheet'
import { Skeleton } from '@/ui/Skeleton'
import { StatusChip } from '@/ui/StatusChip'
import { useWorkContext, type WorkContext } from '@/features/workday/context'
import { useCatalogs, visitsQuery, type Visit } from '@/features/workday/api/queries'
import { AddAddressSheet } from '@/features/workday/pages/WorkdayPage/AddAddressSheet'
import { memberPendingQuery, memberWorkdayQuery, teamDayQuery } from '@/features/team/api/queries'
import { useAssign } from '@/features/team/api/mutations'
import styles from './AssignPage.module.scss'

export interface AssignSearch {
  date?: string
  person?: string
}

/** Assigning workdays: pick a date and a merchandiser, add stores, publish (S03 / SM03). */
export function AssignPage({ date: requested, person }: AssignSearch) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const date = requested ?? addDays(todayInArgentina(), 1)
  const team = useQuery({ ...teamDayQuery(ctx?.companyId ?? '', date), enabled: Boolean(ctx), placeholderData: keepPreviousData })
  const assign = useAssign(ctx?.companyId ?? '')
  const { confirm, dialog } = useConfirm()
  if (!ctx) return null

  const members = (team.data ?? []).filter((m) => m.personId !== ctx.personId)
  const selected = members.find((m) => m.personId === person) ?? members[0]
  const go = (s: AssignSearch) => navigate({ to: '/s/assign', search: { date: s.date ?? date, person: s.person ?? selected?.personId }, replace: true })
  const drafts = members.filter((m) => m.workdayStatus === 'draft' && m.total > 0)

  const publish = async () => {
    const names = drafts.map((m) => m.firstName).join(', ')
    const ok = await confirm({
      title: `¿Publicar ${drafts.length === 1 ? 'la jornada' : `${drafts.length} jornadas`}?`,
      description: `${names} ${drafts.length === 1 ? 'la va' : 'las van'} a ver al abrir la app.`,
      confirmLabel: 'Publicar',
    })
    if (ok) await assign.publish.mutateAsync(drafts.map((m) => m.workdayId as string))
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>Asignar</span>
          <h1 className={styles.title}>Jornada del {formatLongDate(date).toLowerCase()}</h1>
        </div>
        <div className={styles.actions}>
          <Field label="Fecha" type="date" value={date} onChange={(e) => e.target.value && go({ date: e.target.value })} className={styles.dateField} />
          <Button size="md" onClick={publish} disabled={!drafts.length} loading={assign.publish.isPending} className={styles.publishDesktop}>
            <Send size={18} aria-hidden />{drafts.length ? `Publicar a ${drafts.length} ${drafts.length === 1 ? 'activador' : 'activadores'}` : 'Nada para publicar'}
          </Button>
        </div>
      </header>

      {assign.publish.error ? <Banner tone="error">{assign.publish.error.message}</Banner> : null}
      {assign.publish.isSuccess && !drafts.length ? <Banner tone="ok" icon={<Check size={18} aria-hidden />}>Publicada: cada activador ya ve su jornada.</Banner> : null}

      {team.isPending ? (
        <div className={styles.people}>{[0, 1, 2].map((i) => <Skeleton key={i} height={52} width={150} />)}</div>
      ) : !members.length ? (
        <p className={styles.empty}>Todavía no hay activadores en tu equipo.</p>
      ) : (
        <div className={styles.people} role="radiogroup" aria-label="Activador">
          {members.map((m) => (
            <button key={m.personId} type="button" role="radio" aria-checked={m.personId === selected?.personId} className={styles.person} data-on={m.personId === selected?.personId || undefined} onClick={() => go({ person: m.personId })}>
              <Avatar name={initials(m.firstName, m.lastName)} size={28} />
              <span className={styles.personText}>
                <span className={styles.personName}>{m.firstName}</span>
                <span className={styles.personMeta}>{planLabel(m)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <Refreshing active={team.isPlaceholderData}>
        {selected ? <MemberPlan key={`${selected.personId}-${date}`} ctx={ctx} member={selected} date={date} /> : null}
      </Refreshing>

      <div className={styles.publishPhone}>
        <Button onClick={publish} disabled={!drafts.length} loading={assign.publish.isPending}>
          <Send size={18} aria-hidden />{drafts.length ? `Publicar a ${drafts.length} ${drafts.length === 1 ? 'activador' : 'activadores'}` : 'Nada para publicar'}
        </Button>
      </div>
      {dialog}
    </div>
  )
}

function MemberPlan({ ctx, member: m, date }: { ctx: WorkContext; member: TeamMember; date: string }) {
  const assign = useAssign(ctx.companyId)
  const visits = useQuery({ ...visitsQuery(m.workdayId ?? '', ctx.personId), enabled: Boolean(m.workdayId) })
  const pending = useQuery(memberPendingQuery(ctx.companyId, m.personId, date))
  const catalogs = useCatalogs(ctx.companyId)
  const [adding, setAdding] = useState(false)
  const [copying, setCopying] = useState(false)
  const typeName = (id: number) => catalogs.data?.displayTypes.find((t) => t.id === id)?.name ?? 'Exhibición'
  const error = assign.plan.error ?? assign.resume.error ?? assign.remove.error ?? assign.setTask.error

  /** The draft is created the first time something is added. */
  const ensureWorkday = async () => m.workdayId ?? (await assign.plan.mutateAsync({ merchandiserId: m.personId, date }))
  const [workdayForSheet, setWorkdayForSheet] = useState<string | null>(m.workdayId)
  useEffect(() => setWorkdayForSheet(m.workdayId), [m.workdayId])

  const stops = visits.data ?? []
  const toResume = (pending.data ?? []).filter((p) => !stops.some((s) => s.resumedFrom === p.visit_id))

  return (
    <section className={styles.plan} aria-label={`Jornada de ${m.firstName}`}>
      <div className={styles.planHead}>
        <h2 className={styles.heading}>
          {m.workdayId ? `Locales de ${m.firstName} · ${stops.length}` : `${m.firstName} todavía no tiene jornada`}
          {m.workdayStatus === 'published' ? <span className={styles.published}>Publicada</span> : m.workdayStatus === 'draft' ? <span className={styles.draft}>Sin publicar</span> : null}
        </h2>
        <div className={styles.planActions}>
          <Button size="sm" onClick={async () => { setWorkdayForSheet(await ensureWorkday()); setAdding(true) }} loading={assign.plan.isPending}>
            <Plus size={16} aria-hidden />Agregar locales
          </Button>
          {toResume.length ? (
            <Button variant="secondary" size="sm" loading={assign.resume.isPending}
              onClick={async () => assign.resume.mutateAsync({ visitIds: toResume.map((p) => p.visit_id), workdayId: await ensureWorkday() })}>
              <History size={16} aria-hidden />Sumar {toResume.length} {toResume.length === 1 ? 'pendiente' : 'pendientes'}
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => setCopying(true)}><Copy size={16} aria-hidden />Copiar de otro día</Button>
        </div>
      </div>

      {error ? <Banner tone="error">{error.message}</Banner> : null}
      {m.workdayStatus === 'published' ? <p className={styles.help}>{m.firstName} ya ve esta jornada: lo que agregues le aparece al momento.</p> : null}

      {!m.workdayId ? (
        <div className={styles.emptyPlan}>
          <CalendarPlus size={28} aria-hidden />
          <p>Agregá locales del directorio, sumá sus pendientes o copiá otro día. La jornada queda sin publicar hasta que la publiques.</p>
        </div>
      ) : visits.isPending ? (
        <Skeleton height={160} />
      ) : !stops.length ? (
        <p className={styles.help}>Sin locales todavía.</p>
      ) : (
        <ol className={styles.stops}>
          {stops.map((v, i) => (
            <StopRow key={v.id} v={v} n={i + 1} typeName={typeName} assign={assign} />
          ))}
        </ol>
      )}
      {stops.length ? <p className={styles.help}>El orden es una sugerencia: el activador puede reordenar su recorrido.</p> : null}

      {workdayForSheet ? <AddAddressSheet open={adding} onClose={() => setAdding(false)} ctx={ctx} workdayId={workdayForSheet} date={date} forName={m.firstName} /> : null}
      <CopySheet open={copying} onClose={() => setCopying(false)} ctx={ctx} member={m} date={date} ensureWorkday={ensureWorkday} />
    </section>
  )
}

function StopRow({ v, n, typeName, assign }: { v: Visit; n: number; typeName: (id: number) => string; assign: ReturnType<typeof useAssign> }) {
  const [task, setTask] = useState(v.task ?? '')
  useEffect(() => setTask(v.task ?? ''), [v.task])
  const editable = v.workStatus === 'pending'
  return (
    <li className={styles.stop}>
      <span className={styles.num}>{n}</span>
      <span className={styles.stopBody}>
        <span className={styles.stopName}>{v.store.name ?? v.store.address}</span>
        <span className={styles.stopMeta}>
          {[v.store.name ? v.store.address : null, v.store.area, v.store.customerNumber && `Cliente ${v.store.customerNumber}`, v.resumedFrom ? 'retomada' : null, v.source === 'added' ? 'agregada por el activador' : null].filter(Boolean).join(' · ')}
        </span>
        {v.displays.length ? (
          <span className={styles.tags}>{v.displays.map((d) => <span key={d.id} className={styles.tag}>{typeName(d.typeId)}</span>)}</span>
        ) : null}
      </span>
      {editable ? (
        <input
          className={styles.task}
          aria-label={`Tarea en ${v.store.name ?? v.store.address}`}
          placeholder="Tarea"
          value={task}
          maxLength={200}
          onChange={(e) => setTask(e.target.value)}
          onBlur={() => task.trim() !== (v.task ?? '') && assign.setTask.mutate({ visitId: v.id, task })}
        />
      ) : (
        <StatusChip work={v.workStatus} review={v.reviewStatus} />
      )}
      {editable ? (
        <button type="button" className={styles.remove} aria-label={`Quitar ${v.store.name ?? v.store.address}`} onClick={() => assign.remove.mutate(v.id)}>
          <X size={18} aria-hidden />
        </button>
      ) : null}
    </li>
  )
}

/** Copy the stops of this merchandiser's workday on another date. */
function CopySheet({ open, onClose, ctx, member: m, date, ensureWorkday }: { open: boolean; onClose: () => void; ctx: WorkContext; member: TeamMember; date: string; ensureWorkday: () => Promise<string> }) {
  const [from, setFrom] = useState(addDays(date, -7))
  const source = useQuery({ ...memberWorkdayQuery(ctx.companyId, m.personId, from), enabled: open && Boolean(from) })
  const sourceVisits = useQuery({ ...visitsQuery(source.data?.id ?? '', ctx.personId), enabled: Boolean(source.data?.id) })
  const assign = useAssign(ctx.companyId)
  const [done, setDone] = useState<number | null>(null)
  useEffect(() => {
    if (open) setDone(null)
  }, [open])
  const count = sourceVisits.data?.length ?? 0
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Copiar otro día de ${m.firstName}`}
      subtitle={`Se suman a la jornada del ${formatDayMonth(date)} los locales, con su tarea y exhibiciones. Los que ya estén no se repiten.`}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>{done === null ? 'Cancelar' : 'Listo'}</Button>
          {done === null ? (
            <Button size="md" disabled={!count} loading={assign.copy.isPending}
              onClick={async () => setDone(await assign.copy.mutateAsync({ from: source.data?.id as string, to: await ensureWorkday() }))}>
              <Copy size={18} aria-hidden />Copiar {count || ''} {count === 1 ? 'local' : 'locales'}
            </Button>
          ) : null}
        </>
      }
    >
      <Field label="Día a copiar" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setDone(null) }} />
      {source.isFetching ? <Skeleton height={44} /> : source.data ? (
        <p className={styles.help}>{count ? `${count} ${count === 1 ? 'local' : 'locales'} ese día.` : 'Esa jornada no tiene locales.'}</p>
      ) : (
        <p className={styles.help}>{m.firstName} no tuvo jornada ese día.</p>
      )}
      {assign.copy.error ? <Banner tone="error">{assign.copy.error.message}</Banner> : null}
      {done !== null ? <Banner tone="ok" icon={<Check size={18} aria-hidden />}>{done ? `Se sumaron ${done} ${done === 1 ? 'local' : 'locales'}.` : 'Ya estaban todos.'}</Banner> : null}
    </Sheet>
  )
}
