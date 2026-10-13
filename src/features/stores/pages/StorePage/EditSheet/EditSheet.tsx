import { useEffect, useState } from 'react'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { useStoreAdmin, type StoreDetail } from '@/features/stores/api/stores'
import styles from './EditSheet.module.scss'

/** Name, address, customer number and area. A new address has to be located again. */
export function EditSheet({ store, open, onClose }: { store: StoreDetail; open: boolean; onClose: () => void }) {
  const { update } = useStoreAdmin(store.id)
  const [form, setForm] = useState({ name: '', address: '', customerNumber: '', area: '' })
  useEffect(() => {
    if (!open) return
    setForm({ name: store.name ?? '', address: store.address, customerNumber: store.customerNumber ?? '', area: store.area ?? '' })
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when it opens
  }, [open])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const moved = form.address.trim() !== store.address
  const save = async () => {
    await update.mutateAsync({
      name: form.name.trim() || null,
      address: form.address.trim(),
      customerNumber: form.customerNumber.trim() || null,
      area: form.area.trim() || null,
      ...(moved ? { lat: null, lng: null, locationStatus: 'unverified' as const } : {}),
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Editar datos" subtitle={store.name ?? store.address}
      footer={<><Button variant="secondary" size="md" onClick={onClose} className={styles.cancel}>Cancelar</Button><Button size="md" disabled={form.address.trim().length < 3} loading={update.isPending} onClick={save}>Guardar</Button></>}>
      <Field label="Nombre" value={form.name} onChange={set('name')} maxLength={120} placeholder="Opcional" />
      <Field label="Dirección" value={form.address} onChange={set('address')} maxLength={200} help={moved ? 'Cambia la dirección: después volvé a verificar la ubicación.' : undefined} />
      <div className={styles.pair}>
        <Field label="Nro. de cliente" value={form.customerNumber} onChange={set('customerNumber')} inputMode="numeric" maxLength={30} />
        <Field label="Zona" value={form.area} onChange={set('area')} maxLength={60} />
      </div>
      {update.error ? <Banner tone="error">{update.error.message}</Banner> : null}
    </Sheet>
  )
}
