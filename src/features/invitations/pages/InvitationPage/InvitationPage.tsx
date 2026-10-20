import { useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { CalendarX, Check, Clock, LogIn, MailX, PartyPopper, Unlink, UserRound, X } from 'lucide-react'
import { rolesPhrase, timeLeft, type LinkPreview } from '@/domain/invitations'
import { ROLE_PRIORITY } from '@/domain/roles'
import { Banner } from '@/ui/Banner'
import { Button, buttonClass } from '@/ui/Button'
import { FullScreenSpinner } from '@/ui/Spinner'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { GoogleButton } from '@/features/auth/components/GoogleButton'
import { OrDivider } from '@/features/auth/components/OrDivider'
import { refreshMe, useMe } from '@/features/auth/me'
import { setActiveRole } from '@/features/auth/active-role'
import { signOut } from '@/features/auth/api'
import { answerInvitation, InviteError, previewQuery, type Answered } from '@/features/invitations/api'
import { forgetInvite, rememberInvite } from '@/features/invitations/pending'
import { InviteSignUp } from './InviteSignUp'
import styles from './InvitationPage.module.scss'

/** A final screen: what happened and the way on. */
function Result({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className={styles.result} aria-live="polite">
      <span className={styles.resultIcon} aria-hidden>{icon}</span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>{children}</p>
      {action ?? <Link to="/login" className={buttonClass('secondary', 'lg')}><LogIn size={20} aria-hidden />Ir a Visitario</Link>}
    </section>
  )
}

/** The email's link: who invites, then sign up, sign in or complete the profile, and accept. */
export function InvitationPage({ token }: { token: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const preview = useQuery(previewQuery(token))
  const me = useMe()
  const [answered, setAnswered] = useState<{ accepted: boolean; result: Answered } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const p = preview.data

  // Keep the link through sign-up, Google and the profile; forget it once it is answered or dead.
  useEffect(() => {
    if (!p) return
    if (p.state === 'pending' && !answered) rememberInvite(token)
    else forgetInvite()
  }, [p, answered, token])

  if (preview.isPending || me.isPending) return <FullScreenSpinner />
  if (preview.isError || !p) {
    return <AuthLayout><Result icon={<Unlink size={28} />} title="No pudimos abrir la invitación">Revisá la conexión y volvé a abrir el enlace del mail.</Result></AuthLayout>
  }

  const answer = async (accept: boolean) => {
    setError(null)
    setBusy(accept ? 'accept' : 'decline')
    try {
      const result = await answerInvitation({ token }, accept)
      await refreshMe(queryClient)
      setAnswered({ accepted: accept, result })
    } catch (e) {
      setError(e instanceof InviteError ? e.message : 'No se pudo completar. Probá de nuevo.')
      void preview.refetch()
    } finally {
      setBusy(null)
    }
  }
  const start = async (result: Answered) => {
    const role = ROLE_PRIORITY.find((r) => result.roles.includes(r))
    if (role) setActiveRole({ companyId: result.companyId, role })
    await navigate({ to: '/' })
  }

  if (answered) {
    return (
      <AuthLayout>
        {answered.accepted ? (
          <Result icon={<PartyPopper size={28} />} title={`¡Listo! Ya sos parte de ${answered.result.company}`}
            action={<Button onClick={() => void start(answered.result)}>Empezar<Check size={20} aria-hidden /></Button>}>
            Entrás como {rolesPhrase(answered.result.roles)}. Lo que te asignen aparece en tu jornada.
          </Result>
        ) : (
          <Result icon={<X size={28} />} title="Rechazaste la invitación">
            {p.company} ya sabe que no la aceptaste. Si cambiás de idea, pedile a {p.inviter} una nueva.
          </Result>
        )}
      </AuthLayout>
    )
  }

  const closed = closedScreen(p)
  if (closed) return <AuthLayout>{closed}</AuthLayout>

  const person = me.data?.person
  const expiresIn = p.expiresAt ? timeLeft(p.expiresAt, new Date()) : null
  return (
    <AuthLayout>
      <header className={styles.intro}>
        <span className={styles.eyebrow}>Invitación</span>
        <h1 className={styles.title}>{p.inviter} te invitó a {p.company}</h1>
        <p className={styles.lead}>Te suma como <b>{rolesPhrase(p.roles)}</b>. Vas a ver tus jornadas, registrar las visitas con fotos y mandar el informe del día.</p>
        {expiresIn ? <span className={styles.clock}><Clock size={16} aria-hidden />El enlace {expiresIn}</span> : null}
      </header>

      {!me.data ? (
        p.hasAccount ? (
          <section className={styles.step} aria-label="Entrar">
            <p className={styles.stepText}>Ya tenés cuenta en Visitario. Entrá con ella y volvés acá para aceptar.</p>
            <Link to="/login" className={buttonClass('primary', 'lg')}><LogIn size={20} aria-hidden />Entrar para aceptar</Link>
            <GoogleButton />
          </section>
        ) : (
          <section className={styles.step} aria-label="Crear cuenta">
            <InviteSignUp token={token} email={p.email} onDone={(hasProfile) => { if (!hasProfile) void navigate({ to: '/onboarding' }) }} />
            <OrDivider label="o" />
            <GoogleButton />
            <Link to="/login" className={styles.textLink}>Ya tengo cuenta</Link>
          </section>
        )
      ) : !person ? (
        <section className={styles.step} aria-label="Completar datos">
          <p className={styles.stepText}>Antes de aceptar, completá tus datos: DNI, nombre y celular. Es una sola vez y te acompañan si cambiás de empresa.</p>
          <Link to="/onboarding" className={buttonClass('primary', 'lg')}><UserRound size={20} aria-hidden />Completar mis datos</Link>
        </section>
      ) : (
        <section className={styles.step} aria-label="Aceptar">
          <p className={styles.stepText}>Entraste como <b>{person.firstName} {person.lastName}</b>. La invitación es para <b>{p.email}</b>: aceptala con la cuenta de ese email.</p>
          {error ? (
            <Banner tone="error" title={error}>
              {/otro email/.test(error) ? `Entraste con otra cuenta. Salí y entrá con la de ${p.email}.` : null}
            </Banner>
          ) : null}
          {error && /otro email/.test(error) ? (
            <Button variant="secondary" onClick={async () => { await signOut(); await refreshMe(queryClient) }}><LogIn size={20} aria-hidden />Salir y entrar con otra cuenta</Button>
          ) : (
            <div className={styles.answers}>
              <Button loading={busy === 'accept'} disabled={Boolean(busy)} onClick={() => void answer(true)}><Check size={20} aria-hidden />Aceptar y sumarme</Button>
              <Button variant="ghost" loading={busy === 'decline'} disabled={Boolean(busy)} onClick={() => void answer(false)}>Rechazar</Button>
            </div>
          )}
        </section>
      )}
      <p className={styles.fine}>Si no esperabas esta invitación, cerrá esta página: nadie entra a tu nombre con este enlace.</p>
    </AuthLayout>
  )
}

/** Invalid, expired, canceled, declined or used: say so, and what to do. */
function closedScreen(p: LinkPreview) {
  switch (p.state) {
    case 'invalid':
      return <Result icon={<Unlink size={28} />} title="Este enlace no es válido">Puede que esté incompleto o que lo hayan reemplazado por uno nuevo. Pedile a quien te invitó que te lo reenvíe.</Result>
    case 'expired':
      return <Result icon={<CalendarX size={28} />} title="La invitación venció">Los enlaces duran 1 hora. Pedile a {p.inviter} que te la reenvíe desde Visitario: te llega un mail nuevo.</Result>
    case 'canceled':
      return <Result icon={<MailX size={28} />} title="La invitación fue cancelada">{p.company} canceló esta invitación o mandó una más nueva. Revisá tu mail o pedile a {p.inviter} que te invite de nuevo.</Result>
    case 'declined':
      return <Result icon={<X size={28} />} title="Rechazaste esta invitación">Si cambiaste de idea, pedile a {p.inviter} una nueva.</Result>
    case 'accepted':
      return <Result icon={<Check size={28} />} title="Esta invitación ya se usó">Si fuiste vos, ya sos parte de {p.company}: entrá a Visitario.</Result>
    default:
      return null
  }
}
