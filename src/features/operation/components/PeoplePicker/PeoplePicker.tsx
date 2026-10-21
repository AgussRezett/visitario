import { useState } from 'react'
import { Check, Search } from 'lucide-react'
import { normalize } from '@/domain/import'
import { initials } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import type { Teammate } from '@/features/operation/api'
import styles from './PeoplePicker.module.scss'

interface PeoplePickerProps {
  label: string
  people: readonly Teammate[]
  selected: readonly string[]
  onToggle: (personId: string) => void
  /** Shown but not choosable, with the reason ("Ya está", "Vos"). */
  locked?: Record<string, string>
}

/** Choose activadores: tap to add or take out; search when the list is long. */
export function PeoplePicker({ label, people, selected, onToggle, locked = {} }: PeoplePickerProps) {
  const [query, setQuery] = useState('')
  const q = normalize(query)
  const shown = q ? people.filter((p) => normalize(`${p.firstName} ${p.lastName}`).includes(q)) : people
  return (
    <div className={styles.picker}>
      {people.length > 8 ? (
        <label className={styles.search}>
          <Search size={18} aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar activador" aria-label="Buscar activador" />
        </label>
      ) : null}
      <ul className={styles.list} role="group" aria-label={label}>
        {shown.map((p) => {
          const on = selected.includes(p.personId)
          const lock = locked[p.personId]
          return (
            <li key={p.personId}>
              <button type="button" role="checkbox" aria-checked={on || Boolean(lock)} disabled={Boolean(lock)} className={styles.person} onClick={() => onToggle(p.personId)}>
                <Avatar name={initials(p.firstName, p.lastName)} size={36} />
                <span className={styles.name}>{p.firstName} {p.lastName}</span>
                {lock ? <span className={styles.lock}>{lock}</span> : <span className={styles.check} data-on={on || undefined} aria-hidden>{on ? <Check size={16} strokeWidth={3} /> : null}</span>}
              </button>
            </li>
          )
        })}
        {!shown.length ? <li className={styles.empty}>{q ? 'Nadie con ese nombre.' : 'No hay otros activadores en la empresa.'}</li> : null}
      </ul>
    </div>
  )
}
