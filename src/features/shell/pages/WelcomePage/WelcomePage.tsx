import { Briefcase, LogOut, UserRound } from 'lucide-react'
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
import { Logo } from '@/ui/Logo'
import { Avatar } from '@/ui/Avatar'
import { initials } from '@/lib/format'

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
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-6 px-5 py-8 lg:py-12">
      <div className="flex items-center justify-between">
        <Logo />
        <Link to="/profile" aria-label="Mi perfil" className="no-underline">
          {me?.person ? <Avatar name={initials(me.person.firstName, me.person.lastName)} size={36} /> : null}
        </Link>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">{me?.person ? `Hola, ${me.person.firstName}` : 'Hola'}</p>
        <h1 className="text-title font-extrabold tracking-tight lg:text-display">Todavía no tenés empresa</h1>
        <p className="text-ink-muted">Elegí cómo querés empezar. Podés sumarte a una empresa más adelante.</p>
      </div>

      {me?.invitations.length ? (
        <div className="flex flex-col gap-2">
          <Invitations invitations={me.invitations} />
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <Card className="gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-lime-soft text-forest dark:bg-muted dark:text-lime">
              <UserRound size={22} aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-heading font-extrabold">Trabajo por mi cuenta</h2>
              <p className="text-label text-ink-muted">Usá Visitario como autónomo: tus jornadas solo las ves vos.</p>
            </div>
          </div>
          {error ? <Banner tone="error">No pudimos crear tu espacio. Probá de nuevo.</Banner> : null}
          <Button loading={loading || hasCompany} onClick={startSelfEmployed}>
            Empezar como autónomo
          </Button>
        </Card>

        <Card className="flex-row items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-ink-subtle">
            <Briefcase size={22} aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-heading font-extrabold">Trabajo para una empresa</h2>
            <p className="text-label text-ink-muted">Pediles que te den de alta con tu DNI. La invitación te va a aparecer acá y en tu perfil.</p>
          </div>
        </Card>
      </div>

      <div className="mt-auto flex items-center justify-center gap-6 pt-4 text-label font-bold">
        <Link to="/profile" className="text-ink-muted no-underline">Mi perfil</Link>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-ink-muted"
          onClick={async () => {
            await signOut()
            queryClient.clear()
            await navigate({ to: '/login' })
          }}
        >
          <LogOut size={16} aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
