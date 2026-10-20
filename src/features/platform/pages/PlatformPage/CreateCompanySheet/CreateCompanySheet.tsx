import { useEffect, useState } from 'react'
import { ArrowRight, Building2 } from 'lucide-react'
import { KIND_LABEL, type CompanyKind, type PlanKind } from '@/domain/company'
import { isValidDni } from '@/domain/identity'
import { CREATABLE_KINDS, PLAN_SHORT } from '@/domain/platform'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { Sheet } from '@/ui/Sheet'
import { usePlatform, type NewCompany } from '@/features/platform/api'
import { InviteLink } from '@/features/invitations/components/InviteLink'
import styles from './CreateCompanySheet.module.scss'

const EMPTY: NewCompany = { name: '', kind: 'distributor', plan: 'pilot', endsOn: '', adminDni: '', adminEmail: '' }
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** A new company and its first admin, invited by email like everyone else in Visitario. */
export function CreateCompanySheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { create } = usePlatform()
  const [form, setForm] = useState<NewCompany>(EMPTY)
  const set = (patch: Partial<NewCompany>) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    create.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- each opening starts empty
  }, [open])

  if (!open) return null
  const emailOk = EMAIL.test(form.adminEmail.trim())
  const ready = form.name.trim().length > 0 && isValidDni(form.adminDni) && emailOk
  const done = create.data

  if (done) {
    return (
      <Sheet open onClose={() => onCreated(done.companyId)} title={`${form.name.trim()} está creada`} subtitle="Falta que su admin acepte la invitación."
        footer={<Button onClick={() => onCreated(done.companyId)}>Ver la empresa<ArrowRight size={20} aria-hidden /></Button>}>
        {done.invite ? (
          <InviteLink result={done.invite} email={form.adminEmail.trim().toLowerCase()} company={form.name.trim()} />
        ) : (
          <Banner tone="warn" title="No pudimos invitar al admin">{done.inviteError} Invitalo desde la empresa, en Usuarios.</Banner>
        )}
      </Sheet>
    )
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Crear empresa"
      subtitle="Su admin recibe un mail con un enlace que vence en 1 hora."
      footer={
        <Button disabled={!ready} loading={create.isPending} onClick={() => create.mutate(form)}>
          <Building2 size={20} aria-hidden />Crear e invitar al admin
        </Button>
      }
    >
      <div className={styles.form}>
        <Field label="Nombre" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej. Distribuidora Sur" maxLength={80} />
        <div className={styles.pair}>
          <Select label="Tipo" value={form.kind} onChange={(e) => set({ kind: e.target.value as CompanyKind })}
            options={CREATABLE_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          <Select label="Plan" value={form.plan} onChange={(e) => set({ plan: e.target.value as PlanKind })}
            options={(['pilot', 'team', 'free', 'internal'] as const).map((p) => ({ value: p, label: PLAN_SHORT[p] }))} />
        </div>
        {form.plan === 'pilot' || form.plan === 'team' ? (
          <Field label="Vence el" type="date" value={form.endsOn} onChange={(e) => set({ endsOn: e.target.value })} help="Opcional. Para un piloto, el día que termina." />
        ) : null}

        <h3 className={styles.heading}>Admin de la empresa</h3>
        <Field label="DNI" inputMode="numeric" value={form.adminDni} onChange={(e) => set({ adminDni: e.target.value })} placeholder="Sin puntos" maxLength={10} />
        <Field label="Email del admin" type="email" inputMode="email" value={form.adminEmail} onChange={(e) => set({ adminEmail: e.target.value })}
          placeholder="admin@empresa.com" autoComplete="off" error={form.adminEmail.trim() && !emailOk ? 'Revisá el email.' : undefined}
          help="Con el enlace crea su cuenta o entra con la de este email, y acepta." />
        {create.error ? <Banner tone="error">{create.error.message}</Banner> : null}
      </div>
    </Sheet>
  )
}
