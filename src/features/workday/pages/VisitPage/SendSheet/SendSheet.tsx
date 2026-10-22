import { useState } from 'react'
import { Camera, Check, CheckCircle2, LoaderCircle, RotateCw, Send as SendIcon } from 'lucide-react'
import clsx from 'clsx'
import { isReady, nextSend, shareFileName, type Send, type SendGroup } from '@/domain/share-queue'
import { copyText, share } from '@/lib/share'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { sendState, useShareFiles, type SendState } from './useShareFiles'
import styles from './SendSheet.module.scss'

interface SendSheetProps {
  open: boolean
  onClose: () => void
  address: string
  sends: Send[]
  sent: ReadonlySet<string>
  onSent: (key: string) => void
  urlFor: (id: string) => string | undefined
}

const GROUPS: { group: SendGroup; title: string }[] = [
  { group: 'storefront', title: 'Fachada' },
  { group: 'before', title: 'Antes' },
  { group: 'after', title: 'Después' },
]

/**
 * Sends the visit to WhatsApp one message at a time, each with its photos: the main button
 * always offers the next one, so the activador only taps, picks the chat and comes back.
 */
export function SendSheet({ open, onClose, address, sends, sent, onSent, urlFor }: SendSheetProps) {
  const { files, retry } = useShareFiles(sends.flatMap((s) => s.photoIds), urlFor, open)
  const [announce, setAnnounce] = useState('')
  const next = nextSend(sends, sent)
  const done = sends.filter((s) => sent.has(s.key)).length
  const missing = sends.filter((s) => !isReady(s)).length

  const send = (s: Send) => {
    const state = sendState(s.photoIds, files)
    if (state === 'error') return retry()
    if (state !== 'ready') return
    const shared = s.photoIds.flatMap((id, i) => {
      const blob = files[id]
      return blob instanceof Blob ? [new File([blob], shareFileName(s, i), { type: 'image/jpeg' })] : []
    })
    // Copied too: some WhatsApp versions drop the text that comes with photos.
    void copyText(s.text)
    void share({ text: s.text, files: shared }).then((ok) => {
      if (!ok) return
      onSent(s.key)
      setAnnounce(`Enviado: ${s.label}`)
    })
  }

  const nextState = next ? sendState(next.photoIds, files) : null
  const footer = next ? (
    <div className={styles.footer}>
      <Button size="lg" className={styles.main} loading={nextState === 'loading'} onClick={() => send(next)}>
        {nextState === 'error' ? <RotateCw size={20} aria-hidden /> : <SendIcon size={20} aria-hidden />}
        {nextState === 'loading' ? 'Preparando fotos…' : nextState === 'error' ? 'Reintentar fotos' : `Enviar ${next.label}`}
      </Button>
    </div>
  ) : (
    <div className={styles.footer}>
      {missing === 0 ? (
        <p className={styles.allDone}><CheckCircle2 size={20} aria-hidden />Todo enviado</p>
      ) : (
        <p className={styles.note}>Lo que falta se habilita cuando saques sus fotos.</p>
      )}
      <Button variant="secondary" size="lg" className={styles.main} onClick={onClose}>Listo</Button>
    </div>
  )

  return (
    <Sheet open={open} onClose={onClose} title="Enviar a WhatsApp" subtitle={address} footer={footer}>
      <div className={styles.body}>
        <p className={styles.intro}>Cada envío abre WhatsApp con las fotos y su mensaje. Elegí el chat, mandalo y volvé: el siguiente queda listo.</p>
        <div className={styles.progress}>
          <span className={styles.count}>{done} de {sends.length} enviados</span>
          <span className={styles.track} role="progressbar" aria-label="Enviados" aria-valuemin={0} aria-valuemax={sends.length} aria-valuenow={done}>
            <span className={styles.fill} style={{ width: `${sends.length ? (done / sends.length) * 100 : 0}%` }} />
          </span>
        </div>

        {GROUPS.map(({ group, title }) => {
          const rows = sends.filter((s) => s.group === group)
          if (!rows.length) return null
          return (
            <section key={group} className={styles.group} aria-label={title}>
              <h3 className={styles.groupTitle}>{title}</h3>
              <ul className={styles.rows}>
                {rows.map((s) => (
                  <li key={s.key}>
                    <Row send={s} state={sendState(s.photoIds, files)} sent={sent.has(s.key)} isNext={next?.key === s.key} url={s.photoIds[0] ? urlFor(s.photoIds[0]) : undefined} onSend={() => send(s)} />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}

        <p className={styles.hint}>El mensaje también queda copiado: si WhatsApp no lo muestra con la foto, mantené apretado donde se escribe y tocá Pegar.</p>
        <span className={styles.live} aria-live="polite">{announce}</span>
      </div>
    </Sheet>
  )
}

function Row({ send: s, state, sent, isNext, url, onSend }: { send: Send; state: SendState; sent: boolean; isNext: boolean; url: string | undefined; onSend: () => void }) {
  const status = sent
    ? { text: 'Enviado', icon: <Check size={14} strokeWidth={3} aria-hidden />, tone: 'sent' }
    : state === 'missing'
      ? { text: 'Falta la foto', icon: <Camera size={14} aria-hidden />, tone: 'missing' }
      : state === 'loading'
        ? { text: 'Preparando', icon: <LoaderCircle size={14} className={styles.spin} aria-hidden />, tone: 'loading' }
        : state === 'error'
          ? { text: 'Reintentar', icon: <RotateCw size={14} aria-hidden />, tone: 'error' }
          : isNext
            ? { text: 'Siguiente', icon: null, tone: 'next' }
            : { text: 'Listo', icon: null, tone: 'ready' }
  const [broken, setBroken] = useState(false)
  const verb = sent ? 'Volver a enviar' : 'Enviar'
  return (
    <button
      type="button"
      className={clsx(styles.row, isNext && styles.rowNext, sent && styles.rowSent)}
      disabled={state === 'missing' || state === 'loading'}
      onClick={onSend}
      aria-label={`${verb} ${s.label} · ${status.text}`}
    >
      <span className={styles.thumb} aria-hidden>
        {url && !broken ? <img src={url} alt="" className={styles.image} onError={() => setBroken(true)} /> : <Camera size={20} />}
        {s.photoIds.length > 1 ? <span className={styles.more}>{s.photoIds.length}</span> : null}
      </span>
      <span className={styles.texts}>
        <span className={styles.title}>{s.title}</span>
        <span className={styles.preview}>{s.text}</span>
      </span>
      <span className={styles.status} data-tone={status.tone}>
        {status.icon}
        {status.text}
      </span>
    </button>
  )
}
