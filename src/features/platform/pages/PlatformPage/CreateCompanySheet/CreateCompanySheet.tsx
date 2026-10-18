import { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import { KIND_LABEL, type CompanyKind, type PlanKind } from '@/domain/company'
import { CREATABLE_KINDS, PLAN_SHORT } from '@/domain/platform'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { Sheet } from '@/ui/Sheet'
import { usePlatform, type NewCompany } from '@/features/platform/api'
import styles from './CreateCompanySheet.module.scss'

const EMPTY: NewCompany = { name: '', kind: 'distributor', plan: 'pilot', endsOn: '', adminDni: '', firstName: '', lastName: '', phone: '' }

/** A new company and its first admin, invited by DNI like everyone else in Visitario. */
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
  const dni = form.adminDni.replace(/\D/g, '')
  const ready = form.name.trim().length > 0 && /^[0-9]{7,8}$/.test(dni)

  return (
    <Sheet
      open
      onClose={onClose}
      title="Crear empresa"
      subtitle="Su admin recibe la invitación al entrar a Visitario con su DNI."
      footer={
        <Button disabled={!ready} loading={create.isPending} onClick={() => create.mutate(form, { onSuccess: onCreated })}>
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
        <p className={styles.help}>Si ya usa Visitario, con el DNI alcanza. Si no, completá sus datos para crearle la cuenta.</p>
        <div className={styles.pair}>
          <Field label="Nombre del admin" value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} autoComplete="off" />
          <Field label="Apellido" value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} autoComplete="off" />
        </div>
        <Field label="Celular" type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+5491155554521" autoComplete="off" />
        {create.error ? <Banner tone="error">{create.error.message}</Banner> : null}
      </div>
    </Sheet>
  )
}
