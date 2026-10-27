import { Briefcase, LogOut, UserRound } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useMe, refreshMe } from '@/features/auth/me'
import { signOut } from '@/features/auth/api'
import { Invitations } from '@/features/profile/components/Invitations'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Banner } from '@/ui/Banner'
import { Logo } from '@/ui/Logo'
import { PersonAvatar } from '@/features/people/PersonAvatar'
import styles from './WelcomePage.module.scss'

/** Shown to a person with no active company: accept an invitation, wait for one, or work self-employed. */
export function WelcomePage() {
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
    await refreshMe(queryClient)
  }

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <Logo />
        <Link to="/profile" aria-label="Mi perfil">
          {me?.person ? <PersonAvatar personId={me.person.id} firstName={me.person.firstName} lastName={me.person.lastName} size={36} /> : null}
        </Link>
      </div>

      <div className={styles.intro}>
        <p className={styles.eyebrow}>{me?.person ? `Hola, ${me.person.firstName}` : 'Hola'}</p>
        <h1 className={styles.title}>Todavía no tenés empresa</h1>
        <p className={styles.lead}>Elegí cómo querés empezar. Podés sumarte a una empresa más adelante.</p>
      </div>

      {me?.invitations.length ? (
        <div className={styles.invitations}>
          <Invitations invitations={me.invitations} />
        </div>
      ) : null}

      <div className={styles.choices}>
        <Card className={styles.choice}>
          <div className={styles.choiceHead}>
            <span className={styles.choiceIcon}>
              <UserRound size={22} aria-hidden />
            </span>
            <div className={styles.choiceText}>
              <h2 className={styles.choiceTitle}>Trabajo por mi cuenta</h2>
              <p className={styles.choiceLead}>Usá Visitario como autónomo: tus jornadas solo las ves vos.</p>
            </div>
          </div>
          {error ? <Banner tone="error">No pudimos crear tu espacio. Probá de nuevo.</Banner> : null}
          <Button loading={loading || hasCompany} onClick={startSelfEmployed}>
            Empezar como autónomo
          </Button>
        </Card>

        <Card className={styles.choiceRow}>
          <span className={styles.choiceIconMuted}>
            <Briefcase size={22} aria-hidden />
          </span>
          <div className={styles.choiceText}>
            <h2 className={styles.choiceTitle}>Trabajo para una empresa</h2>
            <p className={styles.choiceLead}>Pediles que te den de alta con tu DNI. La invitación te va a aparecer acá y en tu perfil.</p>
          </div>
        </Card>
      </div>

      <div className={styles.footer}>
        <Link to="/profile" className={styles.footerLink}>Mi perfil</Link>
        <button
          type="button"
          className={styles.footerLink}
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
