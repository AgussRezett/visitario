import { useState } from 'react'
import { Mail } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { refreshMe, type Invitation } from '@/features/auth/me'
import { supabase } from '@/lib/supabase'
import { timeLeft } from '@/domain/invitations'
import { ROLE_LABEL } from '@/domain/roles'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { answerInvitation, InviteError } from '@/features/invitations/api'
import styles from './Invitations.module.scss'

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Invitations for my account's email: from the email (they last an hour) or older ones left by an admin. */
export function Invitations({ invitations }: { invitations: Invitation[] }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const respond = async (inv: Invitation, accept: boolean) => {
    setBusy(inv.id)
    setError(null)
    try {
      if (inv.kind === 'email') await answerInvitation({ id: inv.id }, accept)
      else await supabase.rpc('respond_invitation', { p_membership: inv.id, p_accept: accept })
    } catch (e) {
      setError(e instanceof InviteError ? e.message : 'No se pudo completar. Probá de nuevo.')
    }
    setBusy(null)
    await refreshMe(queryClient)
  }

  return (
    <>
      {invitations.map((inv) => (
        <div key={inv.id} className={styles.invitation}>
          <Mail size={20} className={styles.icon} aria-hidden />
          <div className={styles.content}>
            <p className={styles.text}>
              <span className={styles.company}>{inv.inviter ? `${inv.inviter} te invitó a ${inv.companyName}` : `${inv.companyName} te invitó`}</span> como {inv.roles.map((r) => ROLE_LABEL[r].toLowerCase()).join(' y ')} desde el {formatDate(inv.startsOn)}.
              {inv.expiresAt ? <span className={styles.expires}> La invitación {timeLeft(inv.expiresAt, new Date())}.</span> : null}
            </p>
            <div className={styles.buttons}>
              <Button size="md" loading={busy === inv.id} onClick={() => void respond(inv, true)}>Aceptar</Button>
              <Button size="md" variant="secondary" disabled={busy === inv.id} onClick={() => void respond(inv, false)}>Rechazar</Button>
            </div>
          </div>
        </div>
      ))}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </>
  )
}
