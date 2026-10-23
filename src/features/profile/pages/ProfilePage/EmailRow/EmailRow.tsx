import { useState } from 'react'
import { AtSign, Send } from 'lucide-react'
import { isEmail } from '@/domain/profile'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import type { Me } from '@/features/auth/me'
import { useChangeEmail } from '@/features/profile/api'
import styles from './EmailRow.module.scss'

/** My email: to sign in and to get invitations. Changing it takes opening a link sent to the new one. */
export function EmailRow({ me }: { me: Me }) {
  const change = useChangeEmail()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const pending = sentTo ?? me.pendingEmail

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const email = value.trim().toLowerCase()
    if (!isEmail(email)) return setError('Revisá el email')
    if (email === me.email) return setError('Es el mismo que ya tenés')
    setError(null)
    change.mutate(email, { onSuccess: () => { setSentTo(email); setEditing(false); setValue('') } })
  }

  return (
    <div className={styles.block}>
      <div className={styles.row}>
        <AtSign size={20} className={styles.icon} aria-hidden />
        <div className={styles.text}>
          <span className={styles.title}>Email</span>
          <span className={styles.value}>{me.email ?? 'Sin email'}</span>
        </div>
        {!editing ? <Button size="sm" variant="secondary" onClick={() => { change.reset(); setEditing(true) }}>Cambiar</Button> : null}
      </div>
      {editing ? (
        <form className={styles.form} onSubmit={submit} noValidate aria-label="Cambiar email">
          <Field label="Email nuevo" type="email" inputMode="email" autoComplete="email" value={value} onChange={(e) => setValue(e.target.value)} error={error ?? undefined}
            help="Te mandamos un enlace a ese email. El cambio se hace cuando lo abrís." />
          {change.error ? <Banner tone="error">{change.error.message}</Banner> : null}
          <div className={styles.buttons}>
            <Button type="submit" size="md" loading={change.isPending}><Send size={18} aria-hidden />Mandar enlace</Button>
            <Button size="md" variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </form>
      ) : null}
      {pending && !editing ? <div className={styles.notice}><Banner tone="info">Te mandamos un enlace a {pending}. Abrilo para confirmar el cambio; hasta entonces seguís entrando con {me.email}.</Banner></div> : null}
    </div>
  )
}
