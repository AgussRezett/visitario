import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { affected, effective, isEmptyChange, shared, type BulkChange, type Shared } from '@/domain/bulk-edit'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Field } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { Sheet } from '@/ui/Sheet'
import type { Catalogs } from '@/features/workday/api/queries'
import { BulkError, useBulkUpdateStores } from '@/features/stores/api/bulk'
import type { DirectoryRow } from '@/features/stores/api/stores'
import styles from './BulkEditSheet.module.scss'

const KEEP = 'keep'
const NONE = 'none'
const OTHER = 'other'
const MIXED = 'Varios'

interface Props {
  open: boolean
  onClose: () => void
  /** Saved: how many stores changed. */
  onSaved: (count: number) => void
  companyId: string
  rows: readonly DirectoryRow[]
  catalogs: Pick<Catalogs, 'channels' | 'sellers'> | undefined
  areas: readonly string[]
}

const plural = (n: number) => (n === 1 ? '1 comercio' : `${n} comercios`)

/** The same seller, channel or zone for many stores: choose, review, confirm, save. */
export function BulkEditSheet({ open, onClose, onSaved, companyId, rows, catalogs, areas }: Props) {
  const save = useBulkUpdateStores(companyId)
  const { confirm, dialog } = useConfirm()
  const [form, setForm] = useState({ seller: KEEP, channel: KEEP, area: KEEP, otherArea: '' })
  const [step, setStep] = useState<'choose' | 'review'>('choose')
  useEffect(() => {
    if (!open) return
    setForm({ seller: KEEP, channel: KEEP, area: KEEP, otherArea: '' })
    setStep('choose')
    save.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when it opens
  }, [open])

  const sellers = (catalogs?.sellers ?? []).filter((s) => s.active)
  const channels = (catalogs?.channels ?? []).filter((c) => c.active)
  const sellerName = (id: number | null) => (id === null ? 'Sin vendedor' : catalogs?.sellers.find((s) => s.id === id)?.name ?? 'Otro vendedor')
  const channelName = (id: number | null) => (id === null ? 'Sin canal' : catalogs?.channels.find((c) => c.id === id)?.name ?? 'Otro canal')
  const areaName = (a: string | null) => a ?? 'Sin zona'
  const now = {
    seller: shared(rows.map((r) => r.sellerId)),
    channel: shared(rows.map((r) => r.channelId)),
    area: shared(rows.map((r) => r.area)),
  }
  const say = <T,>(s: Shared<T>, name: (v: T) => string) => (s.mixed ? MIXED : name(s.value))
  const keepLabel = <T,>(s: Shared<T>, name: (v: T) => string) => `Dejar como está (${say(s, name)})`
  const help = <T,>(s: Shared<T>, name: (v: T) => string) => (s.mixed ? `Ahora: ${MIXED.toLowerCase()}, ${s.distinct} distintos` : `Ahora todos: ${name(s.value)}`)

  const id = (v: string) => (v === NONE ? null : Number(v))
  const change: BulkChange = {
    ...(form.seller !== KEEP ? { sellerId: id(form.seller) } : {}),
    ...(form.channel !== KEEP ? { channelId: id(form.channel) } : {}),
    ...(form.area === NONE ? { area: null } : form.area === OTHER ? (form.otherArea.trim() ? { area: form.otherArea.trim() } : {}) : form.area !== KEEP ? { area: form.area } : {}),
  }
  const real = effective(rows, change)
  const touched = rows.filter((r) => affected([r], real) > 0)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const lines = [
    'sellerId' in real ? { label: 'Vendedor', from: say(now.seller, sellerName), to: sellerName(real.sellerId ?? null) } : null,
    'channelId' in real ? { label: 'Canal', from: say(now.channel, channelName), to: channelName(real.channelId ?? null) } : null,
    'area' in real ? { label: 'Zona', from: say(now.area, areaName), to: areaName(real.area ?? null) } : null,
  ].filter((l) => l !== null)

  const apply = async () => {
    const ok = await confirm({
      title: `¿Guardar los cambios en ${plural(touched.length)}?`,
      description: `Cambia ${lines.map((l) => l.label.toLowerCase()).join(', ')}. No hay un deshacer: para volver atrás hay que editarlos de nuevo.`,
      confirmLabel: 'Sí, guardar',
    })
    if (!ok) return
    const count = await save.mutateAsync({ ids: touched.map((r) => r.id), change: real }).catch(() => null)
    if (count !== null) onSaved(count)
  }

  const footer = step === 'choose' ? (
    <>
      <Button variant="secondary" size="md" onClick={onClose} className={styles.cancel}>Cancelar</Button>
      <Button size="md" disabled={isEmptyChange(real)} onClick={() => setStep('review')}>Revisar cambios<ArrowRight size={18} aria-hidden /></Button>
    </>
  ) : (
    <>
      <Button variant="secondary" size="md" onClick={() => setStep('choose')} disabled={save.isPending}><ArrowLeft size={18} aria-hidden />Volver</Button>
      <Button size="md" loading={save.isPending} onClick={() => void apply()}><Check size={18} aria-hidden />Aplicar a {plural(touched.length)}</Button>
    </>
  )

  return (
    <>
      <Sheet open={open} onClose={onClose} title={step === 'choose' ? 'Editar en lote' : 'Revisá los cambios'} subtitle={`${plural(rows.length)} seleccionados`} footer={footer}>
        {step === 'choose' ? (
          <>
            <p className={styles.lead}>Elegí solo lo que quieras cambiar. Lo que dejes como está no se toca.</p>
            <div className={styles.field}>
              <Select label="Vendedor" value={form.seller} onChange={set('seller')}
                options={[{ value: KEEP, label: keepLabel(now.seller, sellerName) }, { value: NONE, label: 'Sin vendedor' }, ...sellers.map((s) => ({ value: String(s.id), label: s.name }))]} />
              <p className={styles.now}>{help(now.seller, sellerName)}</p>
            </div>
            <div className={styles.field}>
              <Select label="Canal" value={form.channel} onChange={set('channel')}
                options={[{ value: KEEP, label: keepLabel(now.channel, channelName) }, { value: NONE, label: 'Sin canal' }, ...channels.map((c) => ({ value: String(c.id), label: c.name }))]} />
              <p className={styles.now}>{help(now.channel, channelName)}</p>
            </div>
            <div className={styles.field}>
              <Select label="Zona" value={form.area} onChange={set('area')}
                options={[{ value: KEEP, label: keepLabel(now.area, areaName) }, { value: NONE, label: 'Sin zona' }, ...areas.map((a) => ({ value: a, label: a })), { value: OTHER, label: 'Otra zona…' }]} />
              <p className={styles.now}>{help(now.area, areaName)}</p>
            </div>
            {form.area === OTHER ? <Field label="Nueva zona" value={form.otherArea} onChange={set('otherArea')} maxLength={60} autoFocus /> : null}
            {!isEmptyChange(change) && isEmptyChange(real) ? <Banner tone="info">Los {plural(rows.length)} ya tienen eso: no hay nada que cambiar.</Banner> : null}
          </>
        ) : (
          <>
            <ul className={styles.changes} aria-label="Cambios">
              {lines.map((l) => (
                <li key={l.label} className={styles.change}>
                  <span className={styles.changeLabel}>{l.label}</span>
                  <span className={styles.changeValues}><span className={styles.from}>{l.from}</span><ArrowRight size={16} aria-hidden /><strong>{l.to}</strong></span>
                </li>
              ))}
            </ul>
            <p className={styles.lead}>
              Cambia {plural(touched.length)}
              {touched.length < rows.length ? ` de ${rows.length}: ${plural(rows.length - touched.length)} ya ${rows.length - touched.length === 1 ? 'lo tenía' : 'lo tenían'}` : ''}.
            </p>
            {save.error ? (
              <Banner tone="error">
                {save.error.message}
                {save.error instanceof BulkError && save.error.saved ? ` Se guardaron ${plural(save.error.saved)} antes del error.` : ''}
              </Banner>
            ) : null}
          </>
        )}
      </Sheet>
      {dialog}
    </>
  )
}
