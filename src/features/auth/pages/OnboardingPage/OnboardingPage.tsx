import { useState } from 'react'
import clsx from 'clsx'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { isPlausibleBirthDate, isValidDni, normalizeArPhone, normalizeDni } from '@/domain/identity'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { PasswordField } from '@/ui/PasswordField'
import { Banner } from '@/ui/Banner'
import { Card } from '@/ui/Card'
import { Logo } from '@/ui/Logo'
import { useMe, refreshMe } from '@/features/auth/me'
import { setPassword } from '@/features/auth/api'
import { passwordSchema } from '@/features/auth/schemas'
import { identityErrorMessage } from '@/features/auth/identity-errors'
import { PermissionsStep } from './PermissionsStep'
import styles from './OnboardingPage.module.scss'

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
    await refreshMe(queryClient)
    setStep('permissions')
  })

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <Logo />
        <span className={styles.step}>Paso {step === 'identity' ? 1 : 2} de 2</span>
      </div>
      <div className={styles.progress} aria-hidden>
        <span className={clsx(styles.segment, styles.segmentDone)} />
        <span className={clsx(styles.segment, step === 'permissions' && styles.segmentDone)} />
      </div>

      {step === 'permissions' ? (
        <PermissionsStep onDone={() => navigate({ to: '/' })} />
      ) : (
        <>
          <div className={styles.intro}>
            <h1 className={styles.title}>Validá tu identidad</h1>
            <p className={styles.lead}>Tus datos quedan en tu perfil de Visitario y te acompañan si cambiás de empresa.</p>
          </div>
          <form onSubmit={onSubmit} noValidate className={styles.form}>
            <Card className={styles.fields}>
              <Field label="DNI" inputMode="numeric" autoComplete="off" error={formState.errors.dni?.message} {...register('dni')} />
              <Field label="Fecha de nacimiento" type="date" error={formState.errors.birthDate?.message} {...register('birthDate')} />
              <Field label="Nombre" autoComplete="given-name" error={formState.errors.firstName?.message} {...register('firstName')} />
              <Field label="Apellido" autoComplete="family-name" error={formState.errors.lastName?.message} {...register('lastName')} />
              <Field label="Celular" type="tel" autoComplete="tel-national" placeholder="11 5555-4521" error={formState.errors.phone?.message} {...register('phone')} />
              <Field label="Email" value={me?.email ?? ''} readOnly />
              {needsPassword ? (
                <PasswordField
                  label="Creá una contraseña"
                  autoComplete="new-password"
                  help="Te sirve para entrar con tu DNI."
                  error={formState.errors.password?.message}
                  {...register('password')}
                />
              ) : null}
            </Card>
            <p className={styles.privacy}>Las empresas no ven tu trabajo con otras empresas. Tu DNI y tu celular solo los ves vos.</p>
            {error ? <Banner tone="error">{error}</Banner> : null}
            <Button type="submit" loading={formState.isSubmitting} className={styles.submit}>
              Continuar
            </Button>
          </form>
        </>
      )}
    </div>
  )
}
