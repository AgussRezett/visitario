import { useState } from 'react'
import { CheckCircle2, Send } from 'lucide-react'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { TextArea } from '@/ui/TextArea'
import { sendReport, type ReportInput } from '@/features/errors/report'
import styles from './ReportForm.module.scss'

interface ReportFormProps {
  kind: ReportInput['kind']
  /** For a crash: what broke (sent along, not shown). */
  error?: { message: string; detail: string | null }
  onSent?: () => void
}

/** Tells Visitario what happened. After a crash the comment is optional; written in from the profile, it is the report. */
export function ReportForm({ kind, error, onSent }: ReportFormProps) {
  const [comment, setComment] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const crash = kind === 'crash'
  const ready = crash || comment.trim().length >= 3

  if (state === 'sent') {
    return (
      <p className={styles.sent} role="status">
        <CheckCircle2 size={20} aria-hidden />
        Listo, nos llegó el reporte. Gracias por avisar.
      </p>
    )
  }

  const send = async () => {
    setState('sending')
    try {
      await sendReport({
        kind,
        message: error?.message ?? comment.trim().split('\n')[0]?.slice(0, 120) ?? 'Reporte',
        detail: error?.detail ?? null,
        comment: comment.trim() || null,
      })
      setState('sent')
      onSent?.()
    } catch {
      setState('failed')
    }
  }

  return (
    <form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (ready) void send() }}>
      <TextArea
        label={crash ? '¿Qué estabas haciendo? (opcional)' : 'Contanos qué pasó'}
        help={crash ? 'Nos ayuda a encontrar el problema. El detalle técnico va solo.' : 'Qué estabas haciendo, en qué pantalla y qué esperabas que pasara.'}
        value={comment}
        maxLength={1000}
        rows={3}
        onChange={(e) => setComment(e.target.value)}
      />
      {state === 'failed' ? <Banner tone="error">No se pudo enviar. Revisá la conexión y probá de nuevo.</Banner> : null}
      <Button type="submit" variant={crash ? 'secondary' : 'primary'} size="lg" loading={state === 'sending'} disabled={!ready}>
        <Send size={18} aria-hidden />
        Enviar reporte
      </Button>
    </form>
  )
}
