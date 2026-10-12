import { Briefcase, UserRound } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useMe } from '@/features/auth/me'
import { signOut } from '@/features/auth/api'
import { Invitations } from '@/features/profile/Invitations'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Banner } from '@/ui/Banner'

/** Shown to a person with no active company: accept an invitation, wait for one, or work self-employed. */
export function NoMembership() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const hasCompany = Boolean(me?.memberships.length)

  // Once a company exists (self-employed or an accepted invitation), the entry route picks the role and section.
  useEffect(() => {
    if (hasCompany) void navigate({ to: '/', replace: true })
  }, [hasCompany, navigate])

  const startSelfEmployed = async () => {
    setLoading(true)
    setError(false)
    const { error: e } = await supabase.rpc('create_personal_company')
    if (e) {
      setLoading(false)
      setError(true)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['me'] })
  }

  return (
    <div className="flex max-w-xl flex-col gap-4 px-5 pt-4 lg:px-8 lg:pt-8">
      <h1 className="text-display font-extrabold tracking-tight">Todavía no tenés empresa</h1>
      {me?.invitations.length ? <Invitations invitations={me.invitations} /> : null}
      <Card className="flex-row items-start gap-3">
        <Briefcase className="mt-0.5 shrink-0 text-forest dark:text-lime" size={22} aria-hidden />
        <p className="text-ink-muted">Si trabajás para una distribuidora o agencia, pediles que te den de alta con tu DNI. La invitación te aparece en tu perfil.</p>
      </Card>
      <Card className="gap-3">
        <div className="flex items-start gap-3">
          <UserRound className="mt-0.5 shrink-0 text-forest dark:text-lime" size={22} aria-hidden />
          <p className="text-ink-muted">¿Trabajás por tu cuenta? Usá Visitario como autónomo: tus jornadas solo las ves vos.</p>
        </div>
        {error ? <Banner tone="error">No pudimos crear tu espacio. Probá de nuevo.</Banner> : null}
        <Button loading={loading || hasCompany} onClick={startSelfEmployed}>
          Empezar como autónomo
        </Button>
      </Card>
      <Link to="/profile">Ver mi perfil</Link>
      <button
        type="button"
        onClick={async () => {
          await signOut()
          queryClient.clear()
          await navigate({ to: '/login' })
        }}
      >
        Cerrar sesión
      </button>
    </div>
  )
}
