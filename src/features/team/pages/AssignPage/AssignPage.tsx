import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CalendarPlus, Check, ClipboardPaste, FileUp, History, Plus, Send } from 'lucide-react'
import { addDays, formatLongDate, todayInArgentina } from '@/domain/dates'
import { planLabel, type TeamMember } from '@/domain/team'
import { initials } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Field } from '@/ui/Field'
import { Refreshing } from '@/ui/Refreshing'
import { Skeleton } from '@/ui/Skeleton'
import { useWorkContext, type WorkContext } from '@/features/workday/context'
import { useCatalogs, visitsQuery } from '@/features/workday/api/queries'
import { AddAddressSheet } from '@/features/workday/pages/WorkdayPage/AddAddressSheet'
import { memberPendingQuery, teamDayQuery } from '@/features/team/api/queries'
import { useAssign } from '@/features/team/api/mutations'
import { PendingSheet } from './PendingSheet'
import { StopRow } from './StopRow'
import styles from './AssignPage.module.scss'

export interface AssignSearch {
  date?: string
  person?: string
  /** Visits just added by an import, to say so once. */
  imported?: number
}

/** Assigning workdays: pick a date and a merchandiser, add stores, publish (S03 / SM03). */
export function AssignPage({ date: requested, person, imported }: AssignSearch) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const date = requested ?? addDays(todayInArgentina(), 1)
  const team = useQuery({ ...teamDayQuery(ctx?.companyId ?? '', date), enabled: Boolean(ctx), placeholderData: keepPreviousData })
  const assign = useAssign(ctx?.companyId ?? '')
  const { confirm, dialog } = useConfirm()
  if (!ctx) return null

  // A supervisor who is also a merchandiser plans their own days here too.
  const members = team.data ?? []
  const selected = members.find((m) => m.personId === person) ?? members[0]
  const go = (s: AssignSearch) => navigate({ to: '/s/assign', search: { date: s.date ?? date, person: s.person ?? selected?.personId, imported: s.date ? undefined : imported }, replace: true })
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
          <Button variant="secondary" size="md" onClick={() => navigate({ to: '/s/import', search: { date, person: selected?.personId } })} className={styles.importButton}>
            <FileUp size={18} aria-hidden />Importar planilla
          </Button>
          <Button size="md" onClick={publish} disabled={!drafts.length} loading={assign.publish.isPending} className={styles.publishDesktop}>
            <Send size={18} aria-hidden />{drafts.length ? `Publicar a ${drafts.length} ${drafts.length === 1 ? 'activador' : 'activadores'}` : 'Nada para publicar'}
          </Button>
        </div>
      </header>

      {imported !== undefined && !assign.publish.isSuccess ? (
        <Banner tone="ok" icon={<Check size={18} aria-hidden />}>
          {imported ? `Se agregaron ${imported} ${imported === 1 ? 'local' : 'locales'}. Revisá cada jornada y publicá.` : 'Esos locales ya estaban en las jornadas: no se agregó nada.'}
        </Banner>
      ) : null}
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
                <span className={styles.personName}>{m.firstName}{m.personId === ctx.personId ? ' (vos)' : ''}</span>
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
  const [picking, setPicking] = useState(false)
  /** A task copied from one row, to paste in others. */
  const [copied, setCopied] = useState<string | null>(null)
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
          <Button size="md" onClick={async () => { setWorkdayForSheet(await ensureWorkday()); setAdding(true) }} loading={assign.plan.isPending}>
            <Plus size={16} aria-hidden />Agregar locales
          </Button>
          {toResume.length ? (
            <Button variant="secondary" size="md" onClick={() => setPicking(true)}>
              <History size={16} aria-hidden />Pendientes · {toResume.length}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <Banner tone="error">{error.message}</Banner> : null}
      {m.workdayStatus === 'published' ? <p className={styles.help}>{m.firstName} ya ve esta jornada: lo que agregues le aparece al momento.</p> : null}

      {!m.workdayId ? (
        <div className={styles.emptyPlan}>
          <CalendarPlus size={28} aria-hidden />
          <p>Agregá locales del directorio o sumá sus pendientes de la última semana. La jornada queda sin publicar hasta que la publiques.</p>
        </div>
      ) : visits.isPending ? (
        <Skeleton height={160} />
      ) : !stops.length ? (
        <p className={styles.help}>Sin locales todavía.</p>
      ) : (
        <>
          {copied !== null ? (
            <Banner tone="info" icon={<ClipboardPaste size={18} aria-hidden />}>
              Tarea copiada: "{copied}". Tocá Pegar en las filas que la llevan.
            </Banner>
          ) : null}
          <ol className={styles.stops}>
            {stops.map((v, i) => (
              <StopRow key={v.id} v={v} n={i + 1} typeName={typeName} assign={assign} copied={copied} onCopy={setCopied} />
            ))}
          </ol>
        </>
      )}
      {stops.length ? <p className={styles.help}>El orden es una sugerencia: el activador puede reordenar su recorrido.</p> : null}

      {workdayForSheet ? <AddAddressSheet open={adding} onClose={() => setAdding(false)} ctx={ctx} workdayId={workdayForSheet} date={date} forName={m.firstName} /> : null}
      <PendingSheet open={picking} onClose={() => setPicking(false)} name={m.firstName} visits={toResume} adding={assign.resume.isPending} error={assign.resume.error}
        onAdd={async (visitIds) => assign.resume.mutateAsync({ visitIds, workdayId: await ensureWorkday() })} />
    </section>
  )
}
