import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, UserRound, X } from 'lucide-react'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { storeContactsQuery, useContacts, type ContactInput, type StoreContact } from '@/features/stores/api/contacts'
import styles from './KnownNames.module.scss'

const EMPTY: ContactInput = { name: '', role: '', note: '' }

/**
 * Who to ask for at the store (the owner, the manager): saying a name they know is often what
 * gets you in. Anyone who works the store can add, fix or remove one.
 */
export function KnownNames({ storeId }: { storeId: string }) {
  const contacts = useQuery(storeContactsQuery(storeId))
  const { add, save, remove } = useContacts(storeId)
  // null: the form is closed; '' : adding one; an id: fixing that one.
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<ContactInput>(EMPTY)
  const list = contacts.data ?? []
  const busy = add.isPending || save.isPending
  const error = add.error ?? save.error ?? remove.error

  const open = (c?: StoreContact) => {
    setEditing(c?.id ?? '')
    setForm(c ? { name: c.name, role: c.role ?? '', note: c.note ?? '' } : EMPTY)
  }
  const close = () => setEditing(null)
  const submit = () => {
    if (!form.name.trim()) return
    if (editing) save.mutate({ id: editing, ...form }, { onSuccess: close })
    else add.mutate(form, { onSuccess: close })
  }

  return (
    <section className={styles.card} aria-label="Nombres conocidos">
      <div className={styles.head}>
        <span className={styles.label}>Nombres conocidos</span>
        {editing === null ? (
          <Button variant="ghost" size="sm" onClick={() => open()}><Plus size={16} aria-hidden />Agregar</Button>
        ) : null}
      </div>
      {list.length ? (
        <ul className={styles.list}>
          {list.map((c) => (
            <li key={c.id} className={styles.item}>
              <UserRound size={18} className={styles.icon} aria-hidden />
              <span className={styles.text}>
                <span className={styles.name}>{c.name}{c.role ? <span className={styles.role}> · {c.role}</span> : null}</span>
                {c.note ? <span className={styles.note}>{c.note}</span> : null}
              </span>
              <button type="button" className={styles.action} aria-label={`Editar a ${c.name}`} onClick={() => open(c)}><Pencil size={16} aria-hidden /></button>
              <button type="button" className={styles.action} aria-label={`Quitar a ${c.name}`} disabled={remove.isPending}
                onClick={() => remove.mutate(c.id)}><X size={18} aria-hidden /></button>
            </li>
          ))}
        </ul>
      ) : editing === null ? (
        <p className={styles.help}>¿Conocés al dueño o al encargado? Sumá su nombre: preguntar por alguien que conocen abre la puerta.</p>
      ) : null}

      {editing !== null ? (
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); submit() }}>
          <Field label="Nombre" value={form.name} maxLength={60} required autoComplete="off"
            onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej.: Don Julio" />
          <Field label="Quién es (opcional)" value={form.role} maxLength={40} autoComplete="off"
            onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Dueño, encargada, repositor…" />
          <Field label="Nota (opcional)" value={form.note} maxLength={200} autoComplete="off"
            onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ej.: está de mañana" />
          <div className={styles.buttons}>
            <Button type="submit" size="md" loading={busy} disabled={!form.name.trim()}>{editing ? 'Guardar' : 'Agregar nombre'}</Button>
            <Button type="button" variant="ghost" size="md" onClick={close} disabled={busy}>Cancelar</Button>
          </div>
        </form>
      ) : null}
      {error ? <Banner tone="error">{error.message}</Banner> : null}
    </section>
  )
}
