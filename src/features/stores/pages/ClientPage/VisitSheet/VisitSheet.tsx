import { useEffect, useId, useState } from 'react'
import { Minus, Plus, Save, Trash2 } from 'lucide-react'
import { cleanLines, MAX_ITEM, NO_ORDER_REASONS, OUTCOME_LABEL, type OrderLine, type SellerOutcome } from '@/domain/seller-visits'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { TextArea } from '@/ui/TextArea'
import { newVisitId, useSellerVisits } from '@/features/stores/api/seller-visits'
import styles from './VisitSheet.module.scss'

interface VisitSheetProps {
  open: boolean
  storeId: string
  place: string
  /** Products asked for before and the brands, to suggest. */
  suggestions: string[]
  onClose: () => void
}

const OUTCOMES: SellerOutcome[] = ['order', 'no_order', 'closed']
const fresh = (): OrderLine[] => [{ qty: 1, item: '' }]

/** The seller tells how the visit went: with an order (what was asked for), without one and why, or closed. */
export function VisitSheet({ open, storeId, place, suggestions, onClose }: VisitSheetProps) {
  const { record } = useSellerVisits()
  const list = useId()
  const [id, setId] = useState(newVisitId)
  const [outcome, setOutcome] = useState<SellerOutcome | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [lines, setLines] = useState<OrderLine[]>(fresh)
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!open) return
    setId(newVisitId())
    setOutcome(null)
    setReason(null)
    setLines(fresh())
    setNote('')
    record.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new visit each time it opens
  }, [open])

  const items = cleanLines(lines)
  const ready = outcome !== null && (outcome !== 'order' || items.length > 0)
  const setLine = (i: number, patch: Partial<OrderLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const save = () => outcome && record.mutate({ id, storeId, outcome, reason: outcome === 'no_order' ? reason : null, note, lines: outcome === 'order' ? items : [] }, { onSuccess: onClose })

  return (
    <Sheet open={open} onClose={onClose} title="Registrar visita" subtitle={place}
      footer={<>
        <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
        <Button size="md" disabled={!ready} loading={record.isPending} onClick={save}><Save size={18} aria-hidden />Guardar visita</Button>
      </>}>
      <div className={styles.form}>
        <div className={styles.outcomes} role="radiogroup" aria-label="¿Cómo te fue?">
          {OUTCOMES.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={outcome === o} className={styles.outcome} data-outcome={o} onClick={() => setOutcome(o)}>
              {OUTCOME_LABEL[o]}
            </button>
          ))}
        </div>

        {outcome === 'no_order' ? (
          <div className={styles.reasons} role="radiogroup" aria-label="¿Por qué no hubo pedido?">
            {NO_ORDER_REASONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} className={styles.reason} onClick={() => setReason(reason === r ? null : r)}>{r}</button>
            ))}
          </div>
        ) : null}

        {outcome === 'order' ? (
          <fieldset className={styles.order}>
            <legend className={styles.legend}>Qué pidió</legend>
            <datalist id={list}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
            {lines.map((l, i) => (
              <div key={i} className={styles.line}>
                <div className={styles.qty}>
                  <button type="button" className={styles.step} onClick={() => setLine(i, { qty: Math.max(1, l.qty - 1) })} aria-label="Uno menos"><Minus size={16} aria-hidden /></button>
                  <input className={styles.qtyInput} inputMode="numeric" value={l.qty} aria-label={`Cantidad del producto ${i + 1}`}
                    onChange={(e) => setLine(i, { qty: Math.min(9999, Number(e.target.value.replace(/\D/g, '')) || 0) })} onBlur={() => l.qty < 1 && setLine(i, { qty: 1 })} />
                  <button type="button" className={styles.step} onClick={() => setLine(i, { qty: Math.min(9999, l.qty + 1) })} aria-label="Uno más"><Plus size={16} aria-hidden /></button>
                </div>
                <input className={styles.item} list={list} value={l.item} maxLength={MAX_ITEM} placeholder="Producto (ej.: SKYY 750 caja x6)" aria-label={`Producto ${i + 1}`}
                  onChange={(e) => setLine(i, { item: e.target.value })} />
                {lines.length > 1 ? (
                  <button type="button" className={styles.remove} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label={`Quitar el producto ${i + 1}`}><Trash2 size={18} aria-hidden /></button>
                ) : null}
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, { qty: 1, item: '' }])} className={styles.add} disabled={lines.length >= 60}>
              <Plus size={16} aria-hidden />Agregar producto
            </Button>
            <p className={styles.help}>Sin precios: el pedido se carga en el sistema de la distribuidora. Después lo podés mandar por WhatsApp.</p>
          </fieldset>
        ) : null}

        {outcome ? <TextArea label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder={outcome === 'order' ? 'Ej.: entregar el jueves' : 'Ej.: volver la semana que viene'} /> : null}
        {record.error ? <Banner tone="error">{record.error.message}</Banner> : null}
      </div>
    </Sheet>
  )
}
