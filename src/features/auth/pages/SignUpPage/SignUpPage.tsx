import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Banner } from '@/ui/Banner'
import { AuthLayout } from './AuthLayout'
import { GoogleButton } from './GoogleButton'
import { AuthError, signUp } from './api'
import { passwordSchema } from './schemas'

const schema = z.object({ email: z.string().trim().email('Revisá el email'), password: passwordSchema })
type Values = z.infer<typeof schema>

export function SignUpPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      const { needsEmailConfirmation } = await signUp(email, password)
      if (needsEmailConfirmation) setSentTo(email)
      else await navigate({ to: '/onboarding' })
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Algo salió mal. Probá de nuevo.')
    }
  })

  if (sentTo) {
    return (
      <AuthLayout>
        <h1 className="text-title font-extrabold">Revisá tu email</h1>
        <p className="text-ink-muted">Te mandamos un enlace a {sentTo}. Abrilo desde este dispositivo para seguir con tus datos.</p>
        <Link to="/login" className="font-bold">Volver a entrar</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-1">
        <h1 className="text-display font-extrabold tracking-tight">Crear cuenta</h1>
        <p className="text-ink-muted">Si tu empresa te invitó, creá la cuenta y después validás tu DNI: la invitación aparece sola.</p>
      </div>
      <GoogleButton />
      <div className="flex items-center gap-3 text-label text-ink-subtle">
        <span className="h-px flex-1 bg-line" />o con tu email<span className="h-px flex-1 bg-line" />
      </div>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        <Field label="Creá una contraseña" type="password" autoComplete="new-password" help="Al menos 8 caracteres." error={formState.errors.password?.message} {...register('password')} />
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Button type="submit" loading={formState.isSubmitting}>Crear cuenta</Button>
      </form>
      <Link to="/login" className="self-center font-bold">Ya tengo cuenta</Link>
    </AuthLayout>
  )
}
