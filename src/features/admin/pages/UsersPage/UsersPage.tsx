import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Search, UserPlus } from 'lucide-react'
import { STATUS_LABEL, filterPeople, lastSeen, rolesLabel, type CompanyPerson, type MembershipStatus, type PeopleFilter, type Team } from '@/domain/people'
import { ROLE_LABEL, ROLE_PRIORITY } from '@/domain/roles'
import { initials } from '@/lib/format'
import { useIsDesktop } from '@/lib/useMedia'
import { Avatar } from '@/ui/Avatar'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Segmented } from '@/ui/Segmented'
import { Select } from '@/ui/Select'
import { Skeleton } from '@/ui/Skeleton'
import { Table } from '@/ui/Table'
import { useWorkContext } from '@/features/workday/context'
import { peopleQuery, teamsQuery } from '@/features/admin/api/people'
import { PersonSheet } from './PersonSheet'
import { TeamSheet } from './TeamSheet'
import { TeamsList } from './TeamsList'
import styles from './UsersPage.module.scss'

const TONE: Record<MembershipStatus, string> = { active: 'done', invited: 'closed', disabled: 'pending', declined: 'pending' }

/** People and teams of the company (D01 / DM01). */
export function UsersPage() {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const people = useQuery({ ...peopleQuery(ctx?.companyId ?? ''), enabled: Boolean(ctx) })
  const teams = useQuery({ ...teamsQuery(ctx?.companyId ?? ''), enabled: Boolean(ctx) })
  const [filter, setFilter] = useState<PeopleFilter>({ query: '', role: 'all', team: 'all' })
  const [tab, setTab] = useState<'people' | 'teams'>('people')
  const [editing, setEditing] = useState<string | null>(null)
  const [team, setTeam] = useState<Team | 'new' | null>(null)
  if (!ctx) return null

  const all = people.data ?? []
  const shown = filterPeople(all, filter)
  const teamName = (id: string | null) => teams.data?.find((t) => t.id === id)?.name ?? '—'
  const now = new Date()
  const open = (p: CompanyPerson) => setEditing(p.membershipId)

  const peopleList = (
    <section className={styles.people} aria-label="Personas">
      <div className={styles.filters}>
        <label className={styles.search}>
          <Search size={18} aria-hidden />
          <input value={filter.query} onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))} placeholder="Nombre o celular" aria-label="Buscar personas" />
        </label>
        <Select label="Rol" value={filter.role} onChange={(e) => setFilter((f) => ({ ...f, role: e.target.value as PeopleFilter['role'] }))}
          options={[{ value: 'all', label: 'Rol: todos' }, ...ROLE_PRIORITY.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]} className={styles.filter} />
        <Select label="Equipo" value={filter.team} onChange={(e) => setFilter((f) => ({ ...f, team: e.target.value }))}
          options={[{ value: 'all', label: 'Equipo: todos' }, ...(teams.data ?? []).map((t) => ({ value: t.id, label: t.name })), { value: 'none', label: 'Sin equipo' }]} className={styles.filter} />
      </div>
      {people.isPending ? (
        <Skeleton height={240} />
      ) : people.error ? (
        <Banner tone="error">No pudimos cargar las personas. Revisá la conexión.</Banner>
      ) : desktop ? (
        <Table label="Personas de la empresa">
          <thead><tr><th>Persona</th><th>Rol</th><th>Equipo</th><th>Estado</th><th>Última actividad</th></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.membershipId}>
                <td>
                  <button type="button" className={styles.who} onClick={() => open(p)}>
                    <Avatar name={initials(p.firstName, p.lastName)} size={32} />
                    <span className={styles.whoText}>
                      <span className={styles.name}>{p.firstName} {p.lastName}</span>
                      {p.phoneLast4 ? <span className={styles.meta}>Celular •••• {p.phoneLast4}</span> : null}
                    </span>
                  </button>
                </td>
                <td>{rolesLabel(p.roles)}</td>
                <td>{teamName(p.teamId)}</td>
                <td><span className={styles.chip} data-tone={TONE[p.status]}>{STATUS_LABEL[p.status]}</span></td>
                <td className={styles.meta}>{p.status === 'invited' ? 'Esperando que acepte' : lastSeen(p.lastActivityAt, now)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <ul className={styles.list}>
          {shown.map((p) => (
            <li key={p.membershipId}>
              <button type="button" className={styles.row} onClick={() => open(p)}>
                <Avatar name={initials(p.firstName, p.lastName)} size={36} />
                <span className={styles.whoText}>
                  <span className={styles.name}>{p.firstName} {p.lastName}</span>
                  <span className={styles.meta}>
                    {[rolesLabel(p.roles), p.teamId ? teamName(p.teamId) : null, p.status === 'invited' ? 'invitación enviada' : p.status === 'active' ? lastSeen(p.lastActivityAt, now) : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={styles.chip} data-tone={TONE[p.status]}>{p.status === 'invited' ? 'Invitado' : STATUS_LABEL[p.status]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {people.isSuccess && !shown.length ? <p className={styles.empty}>Nadie coincide con la búsqueda.</p> : null}
    </section>
  )

  const teamsColumn = (
    <section className={styles.teams} aria-label="Equipos">
      {desktop ? <h2 className={styles.heading}>Equipos</h2> : null}
      <TeamsList teams={teams.data ?? []} people={all} onEdit={setTeam} />
      <p className={styles.roles}>Activador: su jornada. Supervisor: su equipo. Admin: toda la empresa, usuarios y configuración.</p>
    </section>
  )

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>{ctx.companyName} · admin</span>
          <h1 className={styles.title}>Usuarios y equipos</h1>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" size="md" onClick={() => setTeam('new')}><Plus size={18} aria-hidden />Nuevo equipo</Button>
          <Button size="md" onClick={() => navigate({ to: '/s/users/new' })}><UserPlus size={18} aria-hidden />Dar de alta</Button>
        </div>
      </header>

      {desktop ? (
        <div className={styles.columns}>{peopleList}{teamsColumn}</div>
      ) : (
        <>
          <Segmented label="Ver" value={tab} onChange={setTab} options={[{ value: 'people', label: `Personas · ${all.length}` }, { value: 'teams', label: `Equipos · ${teams.data?.length ?? 0}` }]} />
          {tab === 'people' ? peopleList : teamsColumn}
        </>
      )}

      <PersonSheet person={all.find((p) => p.membershipId === editing) ?? null} teams={teams.data ?? []} companyId={ctx.companyId} companyName={ctx.companyName} onClose={() => setEditing(null)} />
      <TeamSheet team={team} companyId={ctx.companyId} onClose={() => setTeam(null)} />
    </div>
  )
}
