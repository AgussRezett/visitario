import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { TextArea } from '@/ui/TextArea'
import { issueHint } from './issue-hints'
import styles from './IssuesSection.module.scss'

interface IssueSheetProps {
  open: boolean
  place: string
  types: { id: number; name: string }[]
  onClose: () => void
  onSend: (typeId: number, note: string) => Promise<unknown>
}

/** Picking what happens at the store and, if it helps, a line about it. */
export function IssueSheet({ open, place, types, onClose, onSend }: IssueSheetProps) {
  const [typeId, setTypeId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  useEffect(() => {
    if (!open) return
    setTypeId(null)
    setNote('')
  }, [open])
  const type = types.find((t) => t.id === typeId)

  const send = async () => {
    if (typeId === null) return
    setSending(true)
    try {
      await onSend(typeId, note)
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Reportar novedad" subtitle={place}
      footer={<>
        <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
        <Button size="md" disabled={typeId === null} loading={sending} onClick={() => void send()}><Send size={18} aria-hidden />Enviar al supervisor</Button>
      </>}>
      <div className={styles.form}>
        <div className={styles.types} role="radiogroup" aria-label="Qué pasa">
          {types.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={t.id === typeId} className={styles.type} onClick={() => setTypeId(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
        <TextArea label="Detalle (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3}
          placeholder={type ? issueHint(type.name) : 'Elegí qué pasa y, si querés, agregá un detalle'} />
        <p className={styles.help}>Le llega a tu supervisor aunque no tengas señal ahora: se envía cuando vuelva.</p>
      </div>
    </Sheet>
  )
}
