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
import { AuthError, signUp } from '@/features/auth/api'
import { passwordSchema } from '@/features/auth/schemas'
import styles from './SignUpPage.module.scss'

const schema = z.object({ email: z.string().trim().email('Revisá el email'), password: passwordSchema })
type Values = z.infer<typeof schema>

export function SignUpPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      const { needsEmailConfirmation } = await signUp(email, password)
      if (needsEmailConfirmation) setSentTo(email)
      else {
        await refreshMe(queryClient)
        await navigate({ to: '/onboarding' })
      }
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Algo salió mal. Probá de nuevo.')
    }
  })

  if (sentTo) {
    return (
      <AuthLayout>
        <h1 className={styles.sentTitle}>Revisá tu email</h1>
        <p className={styles.lead}>Te mandamos un enlace a {sentTo}. Abrilo desde este dispositivo para seguir con tus datos.</p>
        <Link to="/login" className={styles.link}>Volver a entrar</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className={styles.intro}>
        <h1 className={styles.title}>Crear cuenta</h1>
        <p className={styles.lead}>Si tu empresa te invitó, creá la cuenta y después validás tu DNI: la invitación aparece sola.</p>
      </div>
      <GoogleButton />
      <OrDivider label="o con tu email" />
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <Field label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        <PasswordField label="Creá una contraseña" autoComplete="new-password" help="Al menos 8 caracteres." error={formState.errors.password?.message} {...register('password')} />
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Button type="submit" loading={formState.isSubmitting}>Crear cuenta</Button>
      </form>
      <Link to="/login" className={styles.backLink}>Ya tengo cuenta</Link>
    </AuthLayout>
  )
}
