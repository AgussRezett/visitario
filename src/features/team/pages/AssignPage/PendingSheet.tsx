import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { formatShortWeekday, formatTime } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import styles from './AssignPage.module.scss'

export interface Pending {
  visit_id: string
  work_date: string
  store_name: string | null
  address: string
  work_status: string
  finished_at: string | null
  pending_displays: number
}

interface PendingSheetProps {
  open: boolean
  onClose: () => void
  name: string
  visits: Pending[]
  adding: boolean
  error: Error | null
  onAdd: (visitIds: string[]) => Promise<unknown>
}

function describe(v: Pending) {
  const parts = [formatShortWeekday(v.work_date), v.work_status === 'closed' ? (v.finished_at ? `Cerrado a las ${formatTime(v.finished_at)}` : 'Cerrado') : 'Pendiente']
  if (v.pending_displays) parts.push(`${v.pending_displays} ${v.pending_displays === 1 ? 'exhibición pendiente' : 'exhibiciones pendientes'}`)
  return parts.join(' · ')
}

/** The merchandiser's pending stops of the last 7 days: the supervisor picks which ones to add. */
export function PendingSheet({ open, onClose, name, visits, adding, error, onAdd }: PendingSheetProps) {
  const [chosen, setChosen] = useState<string[]>([])
  useEffect(() => {
    if (open) setChosen([])
  }, [open])
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  const all = visits.length > 0 && chosen.length === visits.length

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Pendientes de ${name}`}
      subtitle="De los últimos 7 días. Elegí los que suman a esta jornada."
      footer={
        <>
          <Button variant="secondary" className={styles.sheetCancel} onClick={onClose}>Cancelar</Button>
          <Button disabled={!chosen.length} loading={adding} onClick={async () => { await onAdd(chosen); onClose() }}>
            Agregar {chosen.length} a la jornada
          </Button>
        </>
      }
    >
      <div className={styles.counter}>
        <span>{chosen.length} de {visits.length} elegidos</span>
        <Button variant="ghost" size="md" onClick={() => setChosen(all ? [] : visits.map((v) => v.visit_id))}>
          {all ? 'Quitar todos' : 'Elegir todos'}
        </Button>
      </div>
      <div className={styles.pendingList}>
        {visits.map((v) => {
          const on = chosen.includes(v.visit_id)
          return (
            <label key={v.visit_id} className={styles.pendingOption} data-on={on || undefined}>
              <input type="checkbox" checked={on} onChange={() => toggle(v.visit_id)} className={styles.check} />
              <span className={styles.pendingText}>
                <span className={styles.stopName}>{v.store_name ?? v.address}</span>
                <span className={styles.stopMeta}>{v.store_name ? `${v.address} · ` : ''}{describe(v)}</span>
              </span>
            </label>
          )
        })}
      </div>
      <Banner tone="info" icon={<Info size={18} aria-hidden />}>
        Traen comercio, tarea y exhibiciones sin acomodar. No aparecen los que {name} descartó, los de comercios archivados ni los que ya tiene en un día posterior.
      </Banner>
      {error ? <Banner tone="error">{error.message}</Banner> : null}
    </Sheet>
  )
}
