import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { isPlausibleBirthDate, isValidDni, normalizeArPhone, normalizeDni } from '@/domain/identity'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Banner } from '@/ui/Banner'
import { Card } from '@/ui/Card'
import { Logo } from '@/ui/Logo'
import { useMe } from './me'
import { setPassword } from './api'
import { passwordSchema } from './schemas'
import { identityErrorMessage } from './identity-errors'
import { PermissionsStep } from './PermissionsStep'

function buildSchema(needsPassword: boolean) {
  return z.object({
    dni: z.string().refine(isValidDni, 'Son 7 u 8 números, con o sin puntos'),
    firstName: z.string().trim().min(1, 'Ingresá tu nombre').max(80),
    lastName: z.string().trim().min(1, 'Ingresá tu apellido').max(80),
    birthDate: z.string().refine((v) => isPlausibleBirthDate(v), 'Revisá la fecha'),
    phone: z.string().refine((v) => normalizeArPhone(v) !== null, 'Ej.: 11 5555-4521'),
    password: needsPassword ? passwordSchema : z.string().optional(),
  })
}
type Values = z.infer<ReturnType<typeof buildSchema>>

/** First-time identity check (wireframes A02 / AD02). Creates the person or claims an invitation by DNI. */
export function OnboardingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: me } = useMe()
  const [step, setStep] = useState<'identity' | 'permissions'>('identity')
  const [error, setError] = useState<string | null>(null)
  const needsPassword = Boolean(me && !me.hasPassword)
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(buildSchema(needsPassword)) })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    const { error: rpcError } = await supabase.rpc('complete_identity', {
      p_dni: normalizeDni(v.dni),
      p_first_name: v.firstName.trim(),
      p_last_name: v.lastName.trim(),
      p_birth_date: v.birthDate,
      p_phone: normalizeArPhone(v.phone) ?? v.phone,
    })
    if (rpcError) {
      setError(identityErrorMessage(rpcError))
      return
    }
    if (needsPassword && v.password) await setPassword(v.password)
    await queryClient.invalidateQueries({ queryKey: ['me'] })
    setStep('permissions')
  })

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col gap-6 px-5 py-8 lg:py-12">
      <div className="flex items-center justify-between">
        <Logo />
        <span className="text-label font-bold text-ink-subtle">Paso {step === 'identity' ? 1 : 2} de 2</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5" aria-hidden>
        <span className="h-1.5 rounded-full bg-forest dark:bg-lime" />
        <span className={step === 'permissions' ? 'h-1.5 rounded-full bg-forest dark:bg-lime' : 'h-1.5 rounded-full bg-line'} />
      </div>

      {step === 'permissions' ? (
        <PermissionsStep onDone={() => navigate({ to: '/' })} />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-display font-extrabold tracking-tight">Validá tu identidad</h1>
            <p className="text-ink-muted">Tus datos quedan en tu perfil de Visitario y te acompañan si cambiás de empresa.</p>
          </div>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <Card className="gap-4 p-5 lg:grid lg:grid-cols-2">
              <Field label="DNI" inputMode="numeric" autoComplete="off" error={formState.errors.dni?.message} {...register('dni')} />
              <Field label="Fecha de nacimiento" type="date" error={formState.errors.birthDate?.message} {...register('birthDate')} />
              <Field label="Nombre" autoComplete="given-name" error={formState.errors.firstName?.message} {...register('firstName')} />
              <Field label="Apellido" autoComplete="family-name" error={formState.errors.lastName?.message} {...register('lastName')} />
              <Field label="Celular" type="tel" autoComplete="tel-national" placeholder="11 5555-4521" error={formState.errors.phone?.message} {...register('phone')} />
              <Field label="Email" value={me?.email ?? ''} readOnly />
              {needsPassword ? (
                <Field
                  label="Creá una contraseña"
                  type="password"
                  autoComplete="new-password"
                  help="Te sirve para entrar con tu DNI."
                  error={formState.errors.password?.message}
                  {...register('password')}
                />
              ) : null}
            </Card>
            <p className="text-label text-ink-subtle">Las empresas no ven tu trabajo con otras empresas. Tu DNI y tu celular solo los ves vos.</p>
            {error ? <Banner tone="error">{error}</Banner> : null}
            <Button type="submit" loading={formState.isSubmitting} className="lg:self-end lg:px-10">
              Continuar
            </Button>
          </form>
        </>
      )}
    </div>
  )
}
