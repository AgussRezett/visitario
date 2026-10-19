import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { PasswordField } from '@/ui/PasswordField'
import { refreshMe } from '@/features/auth/me'
import { passwordSchema } from '@/features/auth/schemas'
import { InviteError, signUpFromInvitation } from '@/features/invitations/api'
import styles from './InvitationPage.module.scss'

/** A new account for the invited email: the link already proves it is theirs, no confirmation email. */
export function InviteSignUp({ token, email, onDone }: { token: string; email: string; onDone: (hasProfile: boolean) => void }) {
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const check = passwordSchema.safeParse(password)

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      await signUpFromInvitation(token, password)
      const me = await refreshMe(queryClient)
      onDone(Boolean(me?.person))
    } catch (e) {
      setError(e instanceof InviteError ? e.message : 'No se pudo crear la cuenta. Probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={(e) => { e.preventDefault(); if (check.success) void submit() }}>
      <p className={styles.stepText}>Creá tu cuenta para aceptar. Después completás tus datos en un minuto.</p>
      <Field label="Email" type="email" value={email} readOnly help="Es el email de la invitación." />
      <PasswordField label="Creá una contraseña" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
        help="Al menos 8 caracteres. También vas a poder entrar con tu DNI." error={password && !check.success ? check.error.issues[0]?.message : undefined} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button type="submit" disabled={!check.success} loading={busy}><UserPlus size={20} aria-hidden />Crear cuenta y seguir</Button>
    </form>
  )
}
