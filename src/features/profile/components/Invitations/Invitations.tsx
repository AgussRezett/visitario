import { useState } from 'react'
import { Mail } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ROLE_LABEL } from '@/domain/roles'
import { Button } from '@/ui/Button'
import type { Invitation } from '@/features/auth/me'

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
    await queryClient.invalidateQueries({ queryKey: ['me'] })
  }

  return invitations.map((inv) => (
    <div key={inv.membershipId} className="flex gap-3 rounded-md bg-active-soft px-3.5 py-3 text-active-ink">
      <Mail size={20} className="mt-0.5 shrink-0" aria-hidden />
      <div className="flex flex-col gap-2">
        <p className="text-label font-semibold">
          <span className="font-extrabold">{inv.companyName} te invitó</span> como {inv.roles.map((r) => ROLE_LABEL[r].toLowerCase()).join(' y ')} desde el {formatDate(inv.startsOn)}.
        </p>
        <div className="flex gap-2">
          <Button size="sm" loading={busy === inv.membershipId} onClick={() => respond(inv.membershipId, true)}>Aceptar</Button>
          <Button size="sm" variant="secondary" disabled={busy === inv.membershipId} onClick={() => respond(inv.membershipId, false)}>Rechazar</Button>
        </div>
      </div>
    </div>
  ))
}
