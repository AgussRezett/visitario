import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, ChevronLeft, Search, UserCheck, UserPlus } from 'lucide-react'
import { todayInArgentina } from '@/domain/dates'
import { formatDni, isValidDni, normalizeDni } from '@/domain/identity'
import { ROLE_HELP } from '@/domain/people'
import { ROLE_PRIORITY, type Role } from '@/domain/roles'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { useWorkContext } from '@/features/workday/context'
import { adminErrorMessage, findByDni, peopleQuery, teamsQuery, type FoundPerson } from '@/features/admin/api/people'
import { useInvitations, type SentInvitation } from '@/features/invitations/api'
import { InviteLink } from '@/features/invitations/components/InviteLink'
import styles from './InvitePage.module.scss'

const ROLE_NAME: Record<Role, string> = { merchandiser: 'Activador', seller: 'Vendedor', supervisor: 'Supervisor', admin: 'Admin de empresa' }
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Add someone by DNI and email: the email brings a link that lasts an hour (D06 / DM04). */
export function InvitePage() {
  const ctx = useWorkContext()
  const teams = useQuery({ ...teamsQuery(ctx?.companyId ?? ''), enabled: Boolean(ctx) })
  const people = useQuery({ ...peopleQuery(ctx?.companyId ?? ''), enabled: Boolean(ctx) })
  const { create } = useInvitations(ctx?.companyId ?? '')
  const [dni, setDni] = useState('')
  const [email, setEmail] = useState('')
  const [found, setFound] = useState<FoundPerson | null | undefined>(undefined)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [role, setRole] = useState<Role>('merchandiser')
  const [teamId, setTeamId] = useState('')
  const [startsOn, setStartsOn] = useState(todayInArgentina())
  const [sent, setSent] = useState<{ result: SentInvitation; email: string } | null>(null)
  if (!ctx) return null

  const search = async () => {
    setSearchError(null)
    setSearching(true)
    try {
      setFound(await findByDni(ctx.companyId, normalizeDni(dni)))
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : adminErrorMessage(''))
    } finally {
      setSearching(false)
    }
  }
  const membership = found ? people.data?.find((p) => p.personId === found.personId) : undefined
  const alreadyActive = membership?.status === 'active'
  const cleanEmail = email.trim().toLowerCase()
  const emailOk = EMAIL.test(cleanEmail)
  const ready = isValidDni(dni) && emailOk && !alreadyActive
  const firstName = found?.firstName ?? ''

  const send = async () => {
    const result = await create.mutateAsync({ dni: normalizeDni(dni), email: cleanEmail, roles: [role], teamId: role === 'seller' ? null : teamId || null, startsOn })
    setSent({ result, email: cleanEmail })
  }
  const restart = () => {
    setSent(null)
    setDni('')
    setEmail('')
    setFound(undefined)
    create.reset()
  }

  const header = (
    <>
      <Link to="/s/users" className={styles.back}><ChevronLeft size={16} aria-hidden />Usuarios y equipos</Link>
      <div className={styles.titles}>
        <span className={styles.eyebrow}>{ctx.companyName} · admin</span>
        <h1 className={styles.title}>Dar de alta</h1>
      </div>
    </>
  )

  if (sent) {
    return (
      <div className={styles.page}>
        {header}
        <section className={styles.card} aria-label="Invitación">
          <InviteLink result={sent.result} email={sent.email} company={ctx.companyName} />
          <p className={styles.help}>La seguís en Usuarios y equipos → Invitaciones: ahí la reenviás si vence o la cancelás.</p>
        </section>
        <div className={styles.footer}>
          <Button variant="secondary" size="md" onClick={restart}><UserPlus size={18} aria-hidden />Dar de alta a otra persona</Button>
          <Link to="/s/users" className={styles.done}>Volver a usuarios</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {header}
      <div className={styles.columns}>
        <div className={styles.main}>
          <section className={styles.card} aria-label="Buscar por DNI">
            <h2 className={styles.heading}>1 · DNI y email</h2>
            <form className={styles.search} onSubmit={(e) => { e.preventDefault(); if (isValidDni(dni)) void search() }}>
              <Field label="DNI" value={dni} inputMode="numeric" autoComplete="off" placeholder="Ej.: 38.112.904"
                onChange={(e) => { setDni(e.target.value); setFound(undefined) }} className={styles.dni} />
              <Button type="submit" variant="secondary" size="md" disabled={!isValidDni(dni)} loading={searching}><Search size={18} aria-hidden />Ver si ya usa Visitario</Button>
            </form>
            {searchError ? <Banner tone="error">{searchError}</Banner> : null}
            {found ? (
              alreadyActive ? (
                <Banner tone="info" icon={<UserCheck size={18} aria-hidden />} title={`${found.firstName} ${found.lastName} ya es parte de ${ctx.companyName}`}>
                  Cambiá su rol o equipo desde la lista de usuarios.
                </Banner>
              ) : (
                <Banner tone="ok" icon={<Check size={18} aria-hidden />} title="Ya tiene perfil en Visitario">
                  {found.firstName} {found.lastName}. Entra con su cuenta y acepta: no vuelve a cargar sus datos.
                </Banner>
              )
            ) : found === null ? (
              <Banner tone="info" title={`El DNI ${formatDni(dni)} no está en Visitario`}>Con el enlace del mail crea su cuenta y completa su perfil en un minuto.</Banner>
            ) : null}
            <Field label="Email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@ejemplo.com" error={email.trim() && !emailOk ? 'Revisá el email.' : undefined}
              help="Le llega un enlace que vence en 1 hora. Para aceptar, entra con el DNI de arriba." />
            <p className={styles.help}>{ctx.companyName} no ve en qué otras empresas trabajó ni sus visitas anteriores.</p>
          </section>

          <section className={styles.card} aria-label="Rol y equipo">
            <h2 className={styles.heading}>2 · Rol y equipo en {ctx.companyName}</h2>
            <div className={styles.roles} role="radiogroup" aria-label="Rol">
              {ROLE_PRIORITY.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={role === r} className={styles.role} onClick={() => setRole(r)}>
                  <span className={styles.roleName}>{ROLE_NAME[r]}</span>
                  <span className={styles.roleHelp}>{ROLE_HELP[r]}</span>
                  {role === r ? <Check size={18} aria-hidden className={styles.roleCheck} /> : null}
                </button>
              ))}
            </div>
            <div className={styles.pair}>
              {role === 'seller' ? null : (
                <Select label={role === 'supervisor' ? 'Equipo que supervisa' : 'Equipo'} value={teamId} onChange={(e) => setTeamId(e.target.value)}
                  options={[{ value: '', label: 'Sin equipo' }, ...(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))]} />
              )}
              <Field label="Desde" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </div>
          </section>
          {create.error ? <Banner tone="error">{create.error.message}</Banner> : null}
        </div>

        <aside className={styles.aside}>
          <h2 className={styles.asideTitle}>Cómo sigue</h2>
          <ol className={styles.steps}>
            <li>Le llega un mail con un enlace que vence en 1 hora. Si el mail no sale, lo mandás por WhatsApp.</li>
            <li>Desde el enlace crea su cuenta o entra con la suya, completa sus datos si es nuevo y acepta.</li>
            <li>Desde ese momento lo ves en tu equipo y podés asignarle jornadas. Mientras tanto, la invitación queda en Usuarios → Invitaciones.</li>
          </ol>
        </aside>
      </div>
      <div className={styles.footer}>
        <Link to="/s/users" className={styles.cancel}>Cancelar</Link>
        <Button size="md" disabled={!ready} loading={create.isPending} onClick={() => void send().catch(() => null)}>
          <UserPlus size={18} aria-hidden />{firstName ? `Invitar a ${firstName}` : 'Mandar invitación'}
        </Button>
      </div>
    </div>
  )
}
