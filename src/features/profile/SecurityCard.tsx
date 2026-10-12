import { useState } from 'react'
import { KeyRound, Mail } from 'lucide-react'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Field } from '@/ui/Field'
import { Banner } from '@/ui/Banner'
import { setPassword } from '@/features/auth/api'
import type { Me } from '@/features/auth/me'

export function SecurityCard({ me }: { me: Me }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const google = me.providers.includes('google')

  return (
    <Card className="gap-0 py-1">
      <div className="flex min-h-15 items-center gap-3 border-b border-line py-3">
        <KeyRound size={20} className="shrink-0 text-ink-subtle" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-label font-bold">Contraseña</span>
          <span className="text-label text-ink-subtle">{me.hasPassword ? 'Para entrar con tu DNI o email' : 'Todavía no creaste una'}</span>
        </div>
        {!editing ? <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>{me.hasPassword ? 'Cambiar' : 'Crear'}</Button> : null}
      </div>
      {editing ? (
        <form
          className="flex flex-col gap-3 border-b border-line py-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (value.length < 8) return setStatus('error')
            setStatus('saving')
            try {
              await setPassword(value)
              setStatus('ok')
              setEditing(false)
              setValue('')
            } catch {
              setStatus('error')
            }
          }}
        >
          <Field label="Nueva contraseña" type="password" autoComplete="new-password" value={value} onChange={(e) => setValue(e.target.value)} error={status === 'error' ? 'Usá al menos 8 caracteres' : undefined} />
          <div className="flex gap-2">
            <Button type="submit" size="md" loading={status === 'saving'}>Guardar</Button>
            <Button size="md" variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </form>
      ) : null}
      {status === 'ok' ? <div className="py-3"><Banner tone="ok">Contraseña guardada.</Banner></div> : null}
      <div className="flex min-h-15 items-center gap-3 py-3">
        <Mail size={20} className="shrink-0 text-ink-subtle" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-label font-bold">Google</span>
          <span className="truncate text-label text-ink-subtle">{google ? `Vinculado · ${me.email ?? ''}` : 'No vinculado'}</span>
        </div>
      </div>
    </Card>
  )
}
