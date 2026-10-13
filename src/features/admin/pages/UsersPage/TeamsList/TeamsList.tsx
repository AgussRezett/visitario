import { membersOf, supervisorsOf, type CompanyPerson, type Team } from '@/domain/people'
import { initials } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import styles from './TeamsList.module.scss'

/** One card per team: who supervises it, who works in it and its areas. */
export function TeamsList({ teams, people, onEdit }: { teams: Team[]; people: CompanyPerson[]; onEdit: (t: Team) => void }) {
  if (!teams.length) return <p className={styles.empty}>Todavía no hay equipos. Creá uno para repartir a los activadores entre supervisores.</p>
  return (
    <ul className={styles.list} aria-label="Equipos">
      {teams.map((t) => {
        const leads = supervisorsOf(t, people)
        const members = membersOf(t, people)
        return (
          <li key={t.id} className={styles.card}>
            <div className={styles.head}>
              <span className={styles.name}>{t.name}</span>
              <button type="button" className={styles.edit} onClick={() => onEdit(t)} aria-label={`Editar ${t.name}`}>Editar</button>
            </div>
            <span className={styles.lead}>Supervisor: {leads.length ? leads.map((p) => `${p.firstName} ${p.lastName}`).join(', ') : 'sin asignar'}</span>
            {members.length ? (
              <span className={styles.stack} aria-hidden>
                {members.slice(0, 8).map((p) => <Avatar key={p.personId} name={initials(p.firstName, p.lastName)} size={30} className={styles.avatar} />)}
              </span>
            ) : null}
            <span className={styles.meta}>
              {members.length} {members.length === 1 ? 'activador' : 'activadores'}{t.areas ? ` · ${t.areas}` : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
