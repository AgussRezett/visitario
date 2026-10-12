import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Banner } from '@/ui/Banner'
import { AuthLayout } from './AuthLayout'
import { GoogleButton } from './GoogleButton'
import { AuthError, sendPasswordReset, signIn } from './api'

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
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      await navigate({ to: '/' })
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Algo salió mal. Probá de nuevo.')
    }
  })

  return (
    <AuthLayout>
      <h1 className="text-display font-extrabold tracking-tight">Entrar</h1>
      <GoogleButton />
      <div className="flex items-center gap-3 text-label text-ink-subtle">
        <span className="h-px flex-1 bg-line" />o con tu DNI<span className="h-px flex-1 bg-line" />
      </div>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field label="DNI o email" autoComplete="username" inputMode="text" error={formState.errors.identifier?.message} {...register('identifier')} />
        <Field label="Contraseña" type="password" autoComplete="current-password" error={formState.errors.password?.message} {...register('password')} />
        {error ? <Banner tone="error">{error}</Banner> : null}
        {notice ? <Banner tone="ok">{notice}</Banner> : null}
        <Button type="submit" loading={formState.isSubmitting}>
          Entrar
        </Button>
      </form>
      <Button
        variant="ghost"
        size="md"
        className="self-center"
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
      <Link to="/signup" className="flex h-11 items-center justify-center rounded-md border-[1.5px] border-control font-extrabold text-ink no-underline">
        Crear cuenta o aceptar invitación
      </Link>
      <p className="text-center text-label text-ink-subtle">Al entrar vas a la vista de tu rol: jornada, tablero o administración.</p>
    </AuthLayout>
  )
}
