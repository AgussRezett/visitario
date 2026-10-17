import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageIcon, X } from 'lucide-react'
import { formatLongDate, formatShortWeekday, formatTime } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { supabase } from '@/lib/supabase'
import type { WorkContext } from '@/features/workday/context'
import { workdayKeys } from '@/features/workday/api/queries'
import { workdayErrorMessage } from '@/features/workday/api/mutations'
import { useOnline } from '@/lib/online'
import { useDismissPending } from '../useDismissPending'
import styles from './ResumeSheet.module.scss'

interface Resumable {
  visit_id: string
  work_date: string
  store_name: string | null
  address: string
  work_status: 'pending' | 'in_progress' | 'done' | 'refused' | 'closed'
  finished_at: string | null
  pending_displays: number
}

interface ResumeSheetProps {
  open: boolean
  onClose: () => void
  ctx: WorkContext
  date: string
  visits: Resumable[]
  /** The target workday when it already exists; otherwise it is opened first. */
  workdayId?: string
  onDone: () => void
}

function describe(v: Resumable) {
  const parts = [formatShortWeekday(v.work_date)]
  if (v.work_status === 'closed') parts.push(v.finished_at ? `Cerrado a las ${formatTime(v.finished_at)}` : 'Cerrado')
  else parts.push('Pendiente')
  if (v.pending_displays) parts.push(`${v.pending_displays} ${v.pending_displays === 1 ? 'exhibición pendiente' : 'exhibiciones pendientes'}`)
  return parts.join(' · ')
}

/** Pick pending or closed visits from earlier days and add them to this day (wireframes A04 / AD05). */
export function ResumeSheet({ open, onClose, ctx, date, visits, workdayId, onDone }: ResumeSheetProps) {
  const online = useOnline()
  const qc = useQueryClient()
  const [chosen, setChosen] = useState<string[]>([])
  const { dismissOne, dismissAll, dismissing, error: dismissError, dialog } = useDismissPending()
  useEffect(() => {
    if (open) setChosen(visits.map((v) => v.visit_id))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- all chosen when it opens
  }, [open])
  // A discarded one leaves the list (and the choice); the rest stay as they were.
  useEffect(() => {
    setChosen((c) => c.filter((id) => visits.some((v) => v.visit_id === id)))
  }, [visits])
  useEffect(() => {
    if (open && !visits.length) onClose()
  }, [open, visits.length, onClose])

  const resume = useMutation({
    mutationFn: async () => {
      let target = workdayId
      if (!target) {
        const { data, error } = await supabase.rpc('open_workday', { p_company: ctx.companyId, p_date: date })
        if (error) throw new Error(workdayErrorMessage(error))
        target = data
      }
      for (const id of chosen) {
        const { error } = await supabase.rpc('resume_visit', { p_visit: id, p_workday: target })
        if (error) throw new Error(workdayErrorMessage(error))
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: workdayKeys.all }),
    onSuccess: onDone,
  })

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  const all = chosen.length === visits.length

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Retomar pendientes"
      subtitle={`Elegí cuáles vas a visitar. Se suman a tu jornada del ${formatLongDate(date).toLowerCase()}.`}
      footer={
        <>
          <Button variant="secondary" size="md" className={styles.cancel} onClick={onClose}>Cancelar</Button>
          <Button size="md" disabled={!chosen.length || !online} loading={resume.isPending} onClick={() => resume.mutate()}>
            Agregar {chosen.length} a mi jornada
          </Button>
        </>
      }
    >
      {online ? null : <Banner tone="info">Sin señal: para retomar pendientes necesitás conexión.</Banner>}
      <div className={styles.counter}>
        <span>{chosen.length} de {visits.length} elegidas</span>
        <span className={styles.counterActions}>
          <Button variant="ghost" size="sm" onClick={() => setChosen(all ? [] : visits.map((v) => v.visit_id))}>
            {all ? 'Quitar todas' : 'Elegir todas'}
          </Button>
          <Button variant="danger" size="sm" disabled={dismissing} onClick={() => void dismissAll(visits.map((v) => v.visit_id))}>
            Descartar todas
          </Button>
        </span>
      </div>
      <div className={styles.list}>
        {visits.map((v) => {
          const on = chosen.includes(v.visit_id)
          return (
            <div key={v.visit_id} className={on ? styles.optionOn : styles.option}>
              <label className={styles.pick}>
                <input type="checkbox" checked={on} onChange={() => toggle(v.visit_id)} className={styles.check} />
                <span className={styles.text}>
                  <span className={styles.name}>{v.store_name ?? v.address}</span>
                  <span className={styles.meta}>{v.store_name ? `${v.address} · ` : ''}{describe(v)}</span>
                </span>
              </label>
              <button type="button" className={styles.dismiss} onClick={() => dismissOne(v.visit_id)} disabled={dismissing} aria-label={`No retomar ${v.store_name ?? v.address}`} title="No retomar">
                <X size={18} aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
      <Banner tone="info" icon={<ImageIcon size={18} aria-hidden />}>
        Se mantienen comercio, tarea y exhibiciones sin acomodar. Las fotos y registros anteriores quedan en el día original.
      </Banner>
      <p className={styles.hint}>Con la cruz descartás una: no se vuelve a ofrecer y queda en su día como no visitada. Solo se ofrecen las de los últimos 7 días.</p>
      {resume.error ? <Banner tone="error">{resume.error.message}</Banner> : null}
      {dismissError ? <Banner tone="error">{dismissError.message}</Banner> : null}
      {dialog}
    </Sheet>
  )
}
