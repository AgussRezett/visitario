import { Check, Users } from 'lucide-react'
import { normalize, type Person } from '@/domain/import'
import { Button } from '@/ui/Button'
import { Select } from '@/ui/Select'
import type { NameCheck } from '@/features/import/draft'
import styles from './PeopleBox.module.scss'

interface PeopleBoxProps {
  names: NameCheck[]
  people: Person[]
  onConfirm: (name: string, personId: string) => void
}

const full = (p: Person) => `${p.firstName} ${p.lastName}`
/** "Lucía", or "Agus → Agustín" when the spreadsheet calls them differently. */
const shown = (name: string, p: Person) => (normalize(name) === normalize(p.firstName) ? p.firstName : `${name} → ${p.firstName}`)

/** "Repartir por activador": who each name in the spreadsheet is; the unsure ones get confirmed here. */
export function PeopleBox({ names, people, onConfirm }: PeopleBoxProps) {
  const sure = names.filter((n) => n.match.kind === 'sure')
  const unsure = names.filter((n) => n.match.kind !== 'sure')
  const options = [{ value: '', label: 'Elegir activador…' }, ...people.map((p) => ({ value: p.id, label: full(p) }))]

  return (
    <section className={styles.box} aria-label="Repartir por activador">
      <span className={styles.title}><Users size={18} aria-hidden />Repartir por activador</span>
      {sure.length ? (
        <p className={styles.sure}>
          <Check size={16} aria-hidden />
          <span>
            {sure.map((n) => (n.match.kind === 'sure' ? shown(n.name, n.match.person) : '')).join(' · ')}
          </span>
        </p>
      ) : null}
      {unsure.map((n) => (
        <div key={n.name} className={styles.unsure}>
          <span className={styles.name}>
            "{n.name}" · {n.rows} {n.rows === 1 ? 'fila' : 'filas'}
            {n.match.kind === 'guess' ? <span className={styles.guess}> ¿Es {full(n.match.person)}?</span> : <span className={styles.none}> No es nadie del equipo</span>}
          </span>
          <div className={styles.choose}>
            {n.match.kind === 'guess' ? (
              <Button size="sm" variant="secondary" onClick={() => n.match.kind === 'guess' && onConfirm(n.name, n.match.person.id)}>Confirmar</Button>
            ) : null}
            <Select label={`Quién es "${n.name}"`} options={options} value="" onChange={(e) => e.target.value && onConfirm(n.name, e.target.value)} className={styles.select} />
          </div>
        </div>
      ))}
      {!names.length ? <p className={styles.help}>La columna Activador está vacía: todo va a quien elijas en "Para".</p> : null}
    </section>
  )
}
