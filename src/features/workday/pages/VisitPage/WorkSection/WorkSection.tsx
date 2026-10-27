import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ClipboardList } from 'lucide-react'
import { Stepper } from '@/ui/Stepper'
import { TextArea } from '@/ui/TextArea'
import { ToggleTags } from '@/ui/ToggleTag'
import type { Catalogs, Visit } from '@/features/workday/api/queries'
import { visitChanges } from '@/features/sync/changes'
import { useVisitWork } from '@/features/sync/hooks'
import { VisitSection } from '@/features/workday/components/VisitSection'
import styles from './WorkSection.module.scss'

/** Counter that saves a moment after the last tap, so quick taps send one request. */
function MetricStepper({ label, saved, onSave }: { label: string; saved: number; onSave: (n: number) => void }) {
  const [value, setValue] = useState(saved)
  const last = useRef(saved)
  const save = useRef(onSave)
  save.current = onSave
  useEffect(() => {
    setValue(saved)
    last.current = saved
  }, [saved])
  useEffect(() => {
    if (value === last.current) return
    const t = setTimeout(() => {
      last.current = value
      save.current(value)
    }, 600)
    return () => clearTimeout(t)
  }, [value])
  return <Stepper label={label} value={value} onChange={setValue} />
}

/** Work done: quantities, brands and notes. */
export function WorkSection({ visit: v, catalogs, onNotes }: { visit: Visit; catalogs: Catalogs; onNotes: (notes: string) => void }) {
  const work = useVisitWork(v.id)
  const changes = useMemo(() => visitChanges(v), [v])
  const [brands, setBrands] = useState<number[]>([])
  const [notes, setNotes] = useState(v.notes ?? '')
  useEffect(() => setBrands(work.data?.brands ?? []), [work.data?.brands])
  useEffect(() => setNotes(v.notes ?? ''), [v.notes])
  const anything = Object.values(work.data?.metrics ?? {}).some((n) => n > 0) || brands.length > 0 || Boolean(v.notes)

  return (
    <VisitSection state={anything ? 'ok' : 'todo'} icon={anything ? <Check size={16} strokeWidth={3} /> : <ClipboardList size={16} />} title="Trabajo realizado">
      {catalogs.metrics.length ? (
        <div className={styles.metrics}>
          {catalogs.metrics.map((m) => (
            <MetricStepper key={m.id} label={m.name} saved={work.data?.metrics[m.id] ?? 0} onSave={(quantity) => void changes.setMetric(m.id, quantity)} />
          ))}
        </div>
      ) : null}
      {catalogs.brands.length ? (
        <div className={styles.field}>
          <span className={styles.label}>Marcas</span>
          <ToggleTags
            label="Marcas"
            options={catalogs.brands.map((b) => ({ value: b.id, label: b.name }))}
            selected={brands}
            onToggle={(id) => {
              const on = !brands.includes(id)
              setBrands((b) => (on ? [...b, id] : b.filter((x) => x !== id)))
              void changes.setBrand(id, on)
            }}
          />
        </div>
      ) : null}
      <TextArea label="Observaciones" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (v.notes ?? '') && onNotes(notes)} maxLength={2000} placeholder="Lo que tu supervisor tiene que saber" />
    </VisitSection>
  )
}
