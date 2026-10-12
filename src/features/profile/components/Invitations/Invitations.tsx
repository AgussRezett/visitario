import { useState } from 'react'
import { Mail } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { refreshMe } from '@/features/auth/me'
import { supabase } from '@/lib/supabase'
import { ROLE_LABEL } from '@/domain/roles'
import { Button } from '@/ui/Button'
import type { Invitation } from '@/features/auth/me'
import styles from './Invitations.module.scss'

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function Invitations({ invitations }: { invitations: Invitation[] }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  const respond = async (id: string, accept: boolean) => {
    setBusy(id)
    await supabase.rpc('respond_invitation', { p_membership: id, p_accept: accept })
    setBusy(null)
    await refreshMe(queryClient)
  }

  return invitations.map((inv) => (
    <div key={inv.membershipId} className={styles.invitation}>
      <Mail size={20} className={styles.icon} aria-hidden />
      <div className={styles.content}>
        <p className={styles.text}>
          <span className={styles.company}>{inv.companyName} te invitó</span> como {inv.roles.map((r) => ROLE_LABEL[r].toLowerCase()).join(' y ')} desde el {formatDate(inv.startsOn)}.
        </p>
        <div className={styles.buttons}>
          <Button size="sm" loading={busy === inv.membershipId} onClick={() => respond(inv.membershipId, true)}>Aceptar</Button>
          <Button size="sm" variant="secondary" disabled={busy === inv.membershipId} onClick={() => respond(inv.membershipId, false)}>Rechazar</Button>
        </div>
      </div>
    </div>
  ))
}
