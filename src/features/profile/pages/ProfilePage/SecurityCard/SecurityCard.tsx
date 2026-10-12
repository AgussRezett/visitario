import { useState } from 'react'
import clsx from 'clsx'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound, Mail } from 'lucide-react'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Field } from '@/ui/Field'
import { Banner } from '@/ui/Banner'
import { setPassword } from '@/features/auth/api'
import type { Me } from '@/features/auth/me'
import styles from './SecurityCard.module.scss'

export function SecurityCard({ me }: { me: Me }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const google = me.providers.includes('google')

  return (
    <Card className={styles.card}>
      <div className={clsx(styles.row, styles.divided)}>
        <KeyRound size={20} className={styles.icon} aria-hidden />
        <div className={styles.text}>
          <span className={styles.title}>Contraseña</span>
          <span className={styles.status}>{me.hasPassword ? 'Para entrar con tu DNI o email' : 'Todavía no creaste una'}</span>
        </div>
        {!editing ? <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>{me.hasPassword ? 'Cambiar' : 'Crear'}</Button> : null}
      </div>
      {editing ? (
        <form
          className={styles.form}
          onSubmit={async (e) => {
            e.preventDefault()
            if (value.length < 8) return setStatus('error')
            setStatus('saving')
            try {
              await setPassword(value)
              setStatus('ok')
              setEditing(false)
              setValue('')
              await queryClient.invalidateQueries({ queryKey: ['me'] })
            } catch {
              setStatus('error')
            }
          }}
        >
          <Field label="Nueva contraseña" type="password" autoComplete="new-password" value={value} onChange={(e) => setValue(e.target.value)} error={status === 'error' ? 'Usá al menos 8 caracteres' : undefined} />
          <div className={styles.buttons}>
            <Button type="submit" size="md" loading={status === 'saving'}>Guardar</Button>
            <Button size="md" variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </form>
      ) : null}
      {status === 'ok' ? <div className={styles.notice}><Banner tone="ok">Contraseña guardada.</Banner></div> : null}
      <div className={styles.row}>
        <Mail size={20} className={styles.icon} aria-hidden />
        <div className={styles.text}>
          <span className={styles.title}>Google</span>
          <span className={clsx(styles.status, styles.statusTruncate)}>{google ? `Vinculado · ${me.email ?? ''}` : 'No vinculado'}</span>
        </div>
      </div>
    </Card>
  )
}
