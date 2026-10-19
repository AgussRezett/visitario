import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MailX, RefreshCw } from 'lucide-react'
import { INVITE_STATE_LABEL, inviteState, rolesPhrase, timeLeft, type AdminInvitation } from '@/domain/invitations'
import { formatDni } from '@/domain/identity'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Skeleton } from '@/ui/Skeleton'
import { invitationsQuery, useInvitations, type SentInvitation } from '@/features/invitations/api'
import { InviteLink } from '@/features/invitations/components/InviteLink'
import styles from './InvitationsList.module.scss'

const TONE = { sent: 'done', sending: 'muted', failed: 'warn', expired: 'warn' } as const

/** The company's open invitations: who, how it went, and resend or cancel. */
export function InvitationsList({ companyId, companyName, teamName }: { companyId: string; companyName: string; teamName: (id: string | null) => string }) {
  const list = useQuery(invitationsQuery(companyId))
  const { resend, cancel } = useInvitations(companyId)
  const { confirm, dialog } = useConfirm()
  const [resent, setResent] = useState<{ id: string; result: SentInvitation } | null>(null)
  const now = new Date()

  const doResend = async (i: AdminInvitation) => {
    const result = await resend.mutateAsync(i.id).catch(() => null)
    if (result) setResent({ id: i.id, result })
  }
  const doCancel = async (i: AdminInvitation) => {
    const ok = await confirm({
      title: `¿Cancelar la invitación a ${i.email}?`,
      description: 'El enlace deja de funcionar. Podés invitarlo de nuevo cuando quieras.',
      confirmLabel: 'Cancelar invitación',
      cancelLabel: 'Volver',
    })
    if (ok) cancel.mutate(i.id)
  }

  if (list.isPending) return <Skeleton height={120} />
  if (list.isError) return <Banner tone="error">No pudimos cargar las invitaciones. Revisá la conexión.</Banner>
  if (!list.data.length) return <p className={styles.empty}>No hay invitaciones abiertas. Las aceptadas pasan a la lista de personas.</p>

  return (
    <>
      <ul className={styles.list} aria-label="Invitaciones abiertas">
        {list.data.map((i) => {
          const state = inviteState(i, now)
          return (
            <li key={i.id} className={styles.item}>
              <div className={styles.top}>
                <span className={styles.who}>
                  <span className={styles.email}>{i.email}</span>
                  <span className={styles.meta}>DNI {formatDni(i.dni)} · {rolesPhrase(i.roles)}{i.teamId ? ` · ${teamName(i.teamId)}` : ''}</span>
                </span>
                <span className={styles.chip} data-tone={TONE[state]}>{INVITE_STATE_LABEL[state]}</span>
              </div>
              <p className={styles.meta}>
                {state === 'failed' ? 'El mail no salió: reenviala o mandá el enlace por WhatsApp. ' : ''}
                {timeLeft(i.expiresAt, now)}{i.sends > 1 ? ` · enviada ${i.sends} veces` : ''}
              </p>
              {resent?.id === i.id ? (
                <InviteLink result={resent.result} email={i.email} company={companyName} />
              ) : (
                <div className={styles.actions}>
                  <Button variant={state === 'sent' ? 'secondary' : 'primary'} size="md" loading={resend.isPending && resend.variables === i.id} onClick={() => void doResend(i)}>
                    <RefreshCw size={18} aria-hidden />{state === 'sent' ? 'Reenviar' : 'Reenviar con enlace nuevo'}
                  </Button>
                  <Button variant="ghost" size="md" disabled={cancel.isPending} onClick={() => void doCancel(i)}>
                    <MailX size={18} aria-hidden />Cancelar
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {resend.error ? <Banner tone="error">{resend.error.message}</Banner> : null}
      {dialog}
    </>
  )
}
