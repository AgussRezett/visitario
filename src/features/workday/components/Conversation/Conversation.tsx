import { useState } from 'react'
import { Send } from 'lucide-react'
import { formatTime } from '@/domain/dates'
import { PersonAvatar } from '@/features/people/PersonAvatar'
import { Button } from '@/ui/Button'
import { TextArea } from '@/ui/TextArea'
import type { VisitComment } from '@/features/workday/api/comments'
import styles from './Conversation.module.scss'

interface ConversationProps {
  comments: VisitComment[]
  meId: string
  /** Names displays in a comment ("Exhibición 2 · Isla"). */
  displayLabel?: (displayId: string) => string | undefined
  /** Without it the conversation is read-only. */
  onSend?: (body: string) => unknown
  placeholder?: string
}

/** Messages between merchandiser and supervisor about a visit (A14 / AD11 / S02). */
export function Conversation({ comments, meId, displayLabel, onSend, placeholder = 'Escribí una respuesta' }: ConversationProps) {
  const [draft, setDraft] = useState('')
  const send = async () => {
    const body = draft.trim()
    if (!body || !onSend) return
    setDraft('')
    await onSend(body)
  }
  return (
    <div className={styles.conversation}>
      {comments.length ? (
        <ol className={styles.list}>
          {comments.map((c) => {
            const [first = '', last = ''] = c.authorName.split(' ')
            const about = c.displayId ? displayLabel?.(c.displayId) : undefined
            return (
              <li key={c.id} className={styles.message} data-mine={c.authorId === meId || undefined} data-kind={c.kind}>
                <PersonAvatar personId={c.authorId} firstName={first} lastName={last} size={32} />
                <div className={styles.bubble}>
                  <span className={styles.meta}>
                    <b>{c.authorId === meId ? 'Vos' : c.authorName}</b>
                    {c.kind === 'fix_request' ? ' · pidió una corrección' : ''} · {c.pending ? 'sin enviar' : formatTime(c.createdAt)}
                  </span>
                  <p className={styles.body}>{c.body}</p>
                  {about ? <span className={styles.about}>{about}</span> : null}
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className={styles.empty}>Sin mensajes todavía.</p>
      )}
      {onSend ? (
        <div className={styles.composer}>
          <TextArea label="Mensaje" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} maxLength={1000} rows={2} />
          <Button variant="secondary" size="md" onClick={send} disabled={!draft.trim()}>
            <Send size={18} aria-hidden />Enviar
          </Button>
        </div>
      ) : null}
    </div>
  )
}
