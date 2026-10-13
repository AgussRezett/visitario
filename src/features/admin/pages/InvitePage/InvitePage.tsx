import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, ChevronLeft, Copy, MessageCircle, Search, UserCheck, UserPlus } from 'lucide-react'
import { todayInArgentina } from '@/domain/dates'
import { formatDni, isValidDni, normalizeArPhone, normalizeDni } from '@/domain/identity'
import { ROLE_HELP, invitationMessage, whatsappLink } from '@/domain/people'
import { ROLE_PRIORITY, type Role } from '@/domain/roles'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { useWorkContext } from '@/features/workday/context'
import { adminErrorMessage, findByDni, peopleQuery, teamsQuery, useInvite, type FoundPerson } from '@/features/admin/api/people'
import styles from './InvitePage.module.scss'

const ROLE_NAME: Record<Role, string> = { merchandiser: 'Activador', supervisor: 'Supervisor', admin: 'Admin de empresa' }

/** Add someone by DNI: if Visitario knows them nothing is asked again (D06 / DM04). */
export function InvitePage() {
  const ctx = useWorkContext()
  const teams = useQuery({ ...teamsQuery(ctx?.companyId ?? ''), enabled: Boolean(ctx) })
  const people = useQuery({ ...peopleQuery(ctx?.companyId ?? ''), enabled: Boolean(ctx) })
  const invite = useInvite(ctx?.companyId ?? '')
  const [dni, setDni] = useState('')
  const [found, setFound] = useState<FoundPerson | null | undefined>(undefined)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [person, setPerson] = useState({ firstName: '', lastName: '', phone: '' })
  const [role, setRole] = useState<Role>('merchandiser')
  const [teamId, setTeamId] = useState('')
  const [startsOn, setStartsOn] = useState(todayInArgentina())
  const [sent, setSent] = useState<{ firstName: string; phone: string | null } | null>(null)
  const [copied, setCopied] = useState(false)
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
  const alreadyActive = membership?.status === 'active' || membership?.status === 'invited'
  const phone = normalizeArPhone(person.phone)
  const ready = found !== undefined && !alreadyActive && (found !== null || (person.firstName.trim() && person.lastName.trim() && phone))
  const firstName = found?.firstName ?? person.firstName.trim()

  const send = async () => {
    await invite.mutateAsync({
      dni: normalizeDni(dni),
      roles: [role],
      teamId: teamId || null,
      startsOn,
      ...(found ? {} : { firstName: person.firstName.trim(), lastName: person.lastName.trim(), phone: phone ?? undefined }),
    })
    setSent({ firstName, phone: found ? null : phone })
  }
  const restart = () => {
    setSent(null)
    setDni('')
    setFound(undefined)
    setPerson({ firstName: '', lastName: '', phone: '' })
    setCopied(false)
    invite.reset()
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
    const message = invitationMessage(sent.firstName, ctx.companyName, window.location.origin)
    return (
      <div className={styles.page}>
        {header}
        <section className={styles.card}>
          <Banner tone="ok" icon={<Check size={18} aria-hidden />} title={`Listo: ${sent.firstName} tiene la invitación`}>
            La ve en su perfil al entrar a Visitario con su DNI. Avisale por WhatsApp para que no tenga que esperar.
          </Banner>
          <p className={styles.message}>{message}</p>
          <div className={styles.row}>
            <a className={styles.whatsapp} href={whatsappLink(message, sent.phone)} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden />Mandar por WhatsApp</a>
            <Button variant="secondary" size="md" onClick={async () => { await navigator.clipboard?.writeText(message).catch(() => null); setCopied(true) }}>
              <Copy size={18} aria-hidden />{copied ? 'Copiado' : 'Copiar mensaje'}
            </Button>
          </div>
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
            <h2 className={styles.heading}>1 · Buscá por DNI</h2>
            <form className={styles.search} onSubmit={(e) => { e.preventDefault(); if (isValidDni(dni)) void search() }}>
              <Field label="DNI" value={dni} inputMode="numeric" autoComplete="off" placeholder="Ej.: 38.112.904"
                onChange={(e) => { setDni(e.target.value); setFound(undefined) }} className={styles.dni} />
              <Button type="submit" variant="secondary" size="md" disabled={!isValidDni(dni)} loading={searching}><Search size={18} aria-hidden />Buscar</Button>
            </form>
            {searchError ? <Banner tone="error">{searchError}</Banner> : null}
            {found ? (
              alreadyActive ? (
                <Banner tone="info" icon={<UserCheck size={18} aria-hidden />} title={`${found.firstName} ${found.lastName} ya es parte de ${ctx.companyName}`}>
                  {membership?.status === 'invited' ? 'Tiene una invitación sin aceptar: reenviásela desde la lista de usuarios.' : 'Cambiá su rol o equipo desde la lista de usuarios.'}
                </Banner>
              ) : (
                <Banner tone="ok" icon={<Check size={18} aria-hidden />} title="Ya tiene perfil en Visitario">
                  {found.firstName} {found.lastName}{found.phoneLast4 ? ` · celular •••• ${found.phoneLast4}` : ''}. Sus datos personales ya están completos.
                </Banner>
              )
            ) : found === null ? (
              <>
                <Banner tone="info" title={`El DNI ${formatDni(dni)} no está en Visitario`}>Cargá sus datos: le llega la invitación y completa su perfil al entrar.</Banner>
                <div className={styles.pair}>
                  <Field label="Nombre" value={person.firstName} onChange={(e) => setPerson((p) => ({ ...p, firstName: e.target.value }))} autoComplete="off" />
                  <Field label="Apellido" value={person.lastName} onChange={(e) => setPerson((p) => ({ ...p, lastName: e.target.value }))} autoComplete="off" />
                </div>
                <Field label="Celular" value={person.phone} inputMode="tel" placeholder="Ej.: 11 5555-4521" onChange={(e) => setPerson((p) => ({ ...p, phone: e.target.value }))}
                  error={person.phone && !phone ? 'Revisá el número: código de área y número, sin el 15.' : undefined} help="Lo usa para entrar y validar su identidad." />
              </>
            ) : null}
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
              <Select label={role === 'supervisor' ? 'Equipo que supervisa' : 'Equipo'} value={teamId} onChange={(e) => setTeamId(e.target.value)}
                options={[{ value: '', label: 'Sin equipo' }, ...(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))]} />
              <Field label="Desde" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </div>
          </section>
          {invite.error ? <Banner tone="error">{invite.error.message}</Banner> : null}
        </div>

        <aside className={styles.aside}>
          <h2 className={styles.asideTitle}>Cómo sigue</h2>
          <ol className={styles.steps}>
            <li>Le mandás la invitación por WhatsApp desde la pantalla siguiente.</li>
            <li>Si ya usa Visitario, la acepta desde su perfil. Si es nuevo, entra con su DNI y valida su identidad.</li>
            <li>Desde ese momento lo ves en tu equipo y podés asignarle jornadas.</li>
          </ol>
        </aside>
      </div>
      <div className={styles.footer}>
        <Link to="/s/users" className={styles.cancel}>Cancelar</Link>
        <Button size="md" disabled={!ready} loading={invite.isPending} onClick={send}>
          <UserPlus size={18} aria-hidden />{firstName ? `Invitar a ${firstName}` : 'Invitar'}
        </Button>
      </div>
    </div>
  )
}
