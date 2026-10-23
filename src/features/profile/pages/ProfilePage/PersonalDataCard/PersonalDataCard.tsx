import { useState } from 'react'
import { Check, Lock, Pencil } from 'lucide-react'
import { formatDayMonth } from '@/domain/dates'
import { formatDni } from '@/domain/identity'
import { formatArPhone, readProfile, type ProfileErrors, type ProfileInput } from '@/domain/profile'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Field } from '@/ui/Field'
import type { Me } from '@/features/auth/me'
import { useSaveProfile } from '@/features/profile/api'
import styles from './PersonalDataCard.module.scss'

type Person = NonNullable<Me['person']>

const toInput = (p: Person): ProfileInput => ({ firstName: p.firstName, lastName: p.lastName, phone: formatArPhone(p.phone) ?? '', birthDate: p.birthDate ?? '' })

/** Name, phone and birth date, editable; the DNI is shown but stays as it is. */
export function PersonalDataCard({ person: p }: { person: Person }) {
  const save = useSaveProfile(p.id)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ProfileInput>(() => toInput(p))
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [saved, setSaved] = useState(false)
  const set = (key: keyof ProfileInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const start = () => {
    setForm(toInput(p))
    setErrors({})
    setSaved(false)
    save.reset()
    setEditing(true)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const read = readProfile(form)
    setErrors(read.errors)
    if (!read.ok) return
    save.mutate(read.value, { onSuccess: () => { setEditing(false); setSaved(true) } })
  }

  if (editing) {
    return (
      <Card>
        <form className={styles.form} onSubmit={submit} noValidate aria-label="Editar mis datos">
          <div className={styles.pair}>
            <Field label="Nombre" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} error={errors.firstName} maxLength={80} />
            <Field label="Apellido" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} error={errors.lastName} maxLength={80} />
          </div>
          <div className={styles.pair}>
            <Field label="Celular" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="11 5555-4521" value={form.phone} onChange={set('phone')} error={errors.phone} />
            <Field label="Fecha de nacimiento" type="date" autoComplete="bday" value={form.birthDate} onChange={set('birthDate')} error={errors.birthDate} />
          </div>
          {save.error ? <Banner tone="error">{save.error.message}</Banner> : null}
          <div className={styles.buttons}>
            <Button type="submit" size="md" loading={save.isPending}><Check size={18} aria-hidden />Guardar</Button>
            <Button size="md" variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </form>
      </Card>
    )
  }

  const rows: { label: string; value: string | null; empty: string }[] = [
    { label: 'Nombre y apellido', value: `${p.firstName} ${p.lastName}`, empty: '' },
    { label: 'Celular', value: formatArPhone(p.phone), empty: 'Sin cargar' },
    { label: 'Fecha de nacimiento', value: p.birthDate ? formatDayMonth(p.birthDate, true) : null, empty: 'Sin cargar' },
  ]
  return (
    <Card className={styles.card}>
      <dl className={styles.list}>
        {rows.map((r) => (
          <div key={r.label} className={styles.row}>
            <dt className={styles.label}>{r.label}</dt>
            <dd className={r.value ? styles.value : styles.empty}>{r.value ?? r.empty}</dd>
          </div>
        ))}
        <div className={styles.row}>
          <dt className={styles.label}>DNI</dt>
          <dd className={styles.value}>
            {formatDni(p.dni)}
            <span className={styles.locked}><Lock size={14} aria-hidden />No se cambia: es tu identidad en Visitario</span>
          </dd>
        </div>
      </dl>
      {saved ? <Banner tone="ok">Datos guardados.</Banner> : null}
      <Button variant="secondary" size="md" className={styles.edit} onClick={start}><Pencil size={18} aria-hidden />Editar mis datos</Button>
    </Card>
  )
}
