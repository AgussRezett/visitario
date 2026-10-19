import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { refreshMe } from '@/features/auth/me'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { PasswordField } from '@/ui/PasswordField'
import { Banner } from '@/ui/Banner'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { GoogleButton } from '@/features/auth/components/GoogleButton'
import { OrDivider } from '@/features/auth/components/OrDivider'
import { AuthError, sendPasswordReset, signIn } from '@/features/auth/api'
import { pendingInvite } from '@/features/invitations/pending'
import styles from './LoginPage.module.scss'

const schema = z.object({
  identifier: z.string().trim().min(1, 'Ingresá tu DNI o email'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
})
type Values = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { register, handleSubmit, getValues, formState } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ identifier, password }) => {
    setError(null)
    try {
      await signIn(identifier, password)
      await refreshMe(queryClient)
      await navigate({ to: '/' })
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Algo salió mal. Probá de nuevo.')
    }
  })

  return (
    <AuthLayout>
      <h1 className={styles.title}>Entrar</h1>
      {pendingInvite() ? <Banner tone="info">Entrá con tu cuenta: después volvés a la invitación para aceptarla.</Banner> : null}
      <GoogleButton />
      <OrDivider label="o con tu DNI" />
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <Field label="DNI o email" autoComplete="username" inputMode="text" error={formState.errors.identifier?.message} {...register('identifier')} />
        <PasswordField label="Contraseña" autoComplete="current-password" error={formState.errors.password?.message} {...register('password')} />
        {error ? <Banner tone="error">{error}</Banner> : null}
        {notice ? <Banner tone="ok">{notice}</Banner> : null}
        <Button type="submit" loading={formState.isSubmitting}>
          Entrar
        </Button>
      </form>
      <Button
        variant="ghost"
        size="md"
        className={styles.forgot}
        onClick={async () => {
          const id = getValues('identifier')
          if (!id?.includes('@')) {
            setNotice(null)
            setError('Escribí tu email arriba y tocá de nuevo para recibir el enlace.')
            return
          }
          await sendPasswordReset(id)
          setError(null)
          setNotice('Si el email tiene cuenta, te llega un enlace para crear una contraseña nueva.')
        }}
      >
        Olvidé mi contraseña
      </Button>
      <Link to="/signup" className={styles.signUp}>
        Crear cuenta o aceptar invitación
      </Link>
      <p className={styles.hint}>Al entrar vas a la vista de tu rol: jornada, tablero o administración.</p>
    </AuthLayout>
  )
}
