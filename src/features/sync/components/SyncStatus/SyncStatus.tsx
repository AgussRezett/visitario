import { useState } from 'react'
import { AlertTriangle, Camera, Check, CloudOff, RefreshCw, UploadCloud } from 'lucide-react'
import clsx from 'clsx'
import { formatTime } from '@/domain/dates'
import { useOnline } from '@/lib/online'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Sheet } from '@/ui/Sheet'
import { discard, retry, retryAll, syncNow, useSync, type Pending } from '../../outbox'
import styles from './SyncStatus.module.scss'

type Tone = 'ok' | 'sending' | 'offline' | 'failed'

function summary(online: boolean, unsent: number, failed: number): { tone: Tone; long: string } {
  if (failed) return { tone: 'failed', long: failed === 1 ? 'Un cambio no se pudo guardar' : `${failed} cambios no se pudieron guardar` }
  if (!online) return { tone: 'offline', long: unsent ? `Sin señal · ${unsent} ${unsent === 1 ? 'cambio guardado' : 'cambios guardados'} en el celu` : 'Sin señal' }
  if (unsent) return { tone: 'sending', long: `Enviando ${unsent} ${unsent === 1 ? 'cambio' : 'cambios'}` }
  return { tone: 'ok', long: 'Todo guardado' }
}

const ICON = { ok: Check, sending: RefreshCw, offline: CloudOff, failed: AlertTriangle } as const

interface SyncStatusProps {
  /** `compact`: only the icon while everything is saved (phone headers). */
  variant?: 'compact' | 'full'
  className?: string
}

/** Whether the work done on this phone reached the server, and what is still waiting (A06 / AD07). */
export function SyncStatus({ variant = 'compact', className }: SyncStatusProps) {
  const online = useOnline()
  const { rows, lastSyncAt } = useSync()
  const [open, setOpen] = useState(false)
  const unsent = rows.filter((r) => !r.sent && r.state === 'pending')
  const failed = rows.filter((r) => r.state === 'failed')
  const s = summary(online, unsent.length, failed.length)
  const Icon = ICON[s.tone]
  const iconOnly = variant === 'compact' && s.tone === 'ok'
  // Phone headers are tight: icon and number; the sheet tells the rest.
  const count = failed.length || unsent.length
  const text = variant === 'full' ? s.long : count ? String(count) : s.tone === 'offline' ? 'Sin señal' : null

  return (
    <>
      <button
        type="button"
        className={clsx(styles.pill, styles[s.tone], iconOnly && styles.iconOnly, className)}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${s.long}. Ver sincronización`}
      >
        <Icon size={16} strokeWidth={2.5} className={s.tone === 'sending' ? styles.spin : undefined} aria-hidden />
        {iconOnly || !text ? null : <span>{text}</span>}
      </button>
      <SyncSheet open={open} onClose={() => setOpen(false)} online={online} unsent={unsent} failed={failed} lastSyncAt={lastSyncAt} title={s.long} tone={s.tone} />
    </>
  )
}

const LEAD: Record<Tone, string> = {
  ok: 'Todo lo que cargaste ya está en el servidor y tu supervisor lo ve.',
  sending: 'Se están enviando los cambios en el orden en que los hiciste.',
  offline: 'Seguí trabajando: lo que cargás queda guardado en este celular y se envía solo cuando vuelva la señal. No cierres sesión hasta que se envíe.',
  failed: 'El servidor no aceptó estos cambios. Podés reintentarlos o descartarlos para quedarte con lo que hay en el servidor.',
}

function SyncSheet(props: { open: boolean; onClose: () => void; online: boolean; unsent: Pending[]; failed: Pending[]; lastSyncAt: string | null; title: string; tone: Tone }) {
  const { open, onClose, online, unsent, failed, lastSyncAt, title, tone } = props
  const { confirm, dialog } = useConfirm()
  const shown = unsent.slice(0, 30)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={lastSyncAt ? `Última sincronización: ${formatTime(lastSyncAt)}` : undefined}
      footer={
        failed.length || (online && unsent.length) ? (
          <Button size="md" onClick={() => (failed.length ? retryAll() : syncNow())}>
            <RefreshCw size={18} aria-hidden />
            {failed.length ? 'Reintentar todo' : 'Enviar ahora'}
          </Button>
        ) : undefined
      }
    >
      <div className={styles.body}>
        <p className={styles.lead}>{LEAD[tone]}</p>

        {failed.length ? (
          <section className={styles.group} aria-label="No se pudieron guardar">
            <h3 className={styles.groupTitle}>No se pudieron guardar</h3>
            <ul className={styles.list}>
              {failed.map((r) => (
                <li key={r.id} className={styles.rowFailed}>
                  <ItemIcon row={r} />
                  <span className={styles.rowText}>
                    <span className={styles.rowLabel}>{r.label}</span>
                    {r.error ? <span className={styles.rowError}>{r.error}</span> : null}
                  </span>
                  <span className={styles.rowActions}>
                    <Button variant="secondary" size="sm" onClick={() => retry(r.id)}>Reintentar</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const ok = await confirm({
                          title: '¿Descartar este cambio?',
                          description: `${r.label}. Se borra de este celular y queda lo que hay en el servidor.`,
                          confirmLabel: 'Descartar',
                          tone: 'danger',
                        })
                        if (ok) await discard(r.id)
                      }}
                    >
                      Descartar
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {unsent.length ? (
          <section className={styles.group} aria-label="Por enviar">
            <h3 className={styles.groupTitle}>Por enviar · {unsent.length}</h3>
            <ul className={styles.list}>
              {shown.map((r) => (
                <li key={r.id} className={styles.row}>
                  <ItemIcon row={r} />
                  <span className={styles.rowText}>
                    <span className={styles.rowLabel}>{r.label}</span>
                    <span className={styles.rowMeta}>
                      {formatTime(r.createdAt)}
                      {r.attempts ? ` · ${r.attempts} ${r.attempts === 1 ? 'intento' : 'intentos'}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {unsent.length > shown.length ? <p className={styles.more}>y {unsent.length - shown.length} más</p> : null}
          </section>
        ) : null}

        {!failed.length && !unsent.length ? (
          <p className={styles.empty}>
            <Check size={18} strokeWidth={3} aria-hidden />
            No hay nada pendiente en este celular.
          </p>
        ) : null}
      </div>
      {dialog}
    </Sheet>
  )
}

function ItemIcon({ row }: { row: Pending }) {
  const Icon = row.op.kind === 'photo.add' ? Camera : UploadCloud
  return (
    <span className={styles.rowIcon} aria-hidden>
      <Icon size={18} />
    </span>
  )
}
