import { useEffect, useState } from 'react'
import { parseLocation } from '@/domain/places'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { useStoreAdmin, type StoreDetail } from '@/features/stores/api/stores'
import styles from './EditSheet.module.scss'

/**
 * Name, address, customer number and area. A new address has to be located again,
 * unless the exact location is pasted by hand (coordinates or a Google Maps link).
 */
export function EditSheet({ store, open, onClose }: { store: StoreDetail; open: boolean; onClose: () => void }) {
  const { update } = useStoreAdmin(store.id)
  const [form, setForm] = useState({ name: '', address: '', customerNumber: '', area: '', location: '' })
  useEffect(() => {
    if (!open) return
    setForm({ name: store.name ?? '', address: store.address, customerNumber: store.customerNumber ?? '', area: store.area ?? '', location: '' })
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when it opens
  }, [open])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const moved = form.address.trim() !== store.address
  const pinned = parseLocation(form.location)
  const badPin = form.location.trim() !== '' && !pinned
  const save = async () => {
    await update.mutateAsync({
      name: form.name.trim() || null,
      address: form.address.trim(),
      customerNumber: form.customerNumber.trim() || null,
      area: form.area.trim() || null,
      ...(pinned ? { lat: pinned.lat, lng: pinned.lng, locationStatus: 'verified' as const } : moved ? { lat: null, lng: null, locationStatus: 'unverified' as const } : {}),
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Editar datos" subtitle={store.name ?? store.address}
      footer={<><Button variant="secondary" size="md" onClick={onClose} className={styles.cancel}>Cancelar</Button><Button size="md" disabled={form.address.trim().length < 3 || badPin} loading={update.isPending} onClick={save}>Guardar</Button></>}>
      <Field label="Nombre" value={form.name} onChange={set('name')} maxLength={120} placeholder="Opcional" />
      <Field label="Dirección" value={form.address} onChange={set('address')} maxLength={200} help={moved && !pinned ? 'Cambia la dirección: después volvé a verificar la ubicación.' : undefined} />
      <div className={styles.pair}>
        <Field label="Nro. de cliente" value={form.customerNumber} onChange={set('customerNumber')} inputMode="numeric" maxLength={30} />
        <Field label="Zona" value={form.area} onChange={set('area')} maxLength={60} />
      </div>
      <Field
        label="Ubicación exacta"
        value={form.location}
        onChange={set('location')}
        placeholder="Opcional: coordenadas o link de Google Maps"
        error={badPin ? 'No encontramos coordenadas ahí. Copiá las coordenadas del lugar o el link largo de Google Maps.' : undefined}
        help={pinned ? `Se guarda en ${pinned.lat.toFixed(5)}, ${pinned.lng.toFixed(5)} como verificada.` : 'En Google Maps, mantené apretado el local hasta que aparezca el pin y copiá las coordenadas.'}
      />
      {update.error ? <Banner tone="error">{update.error.message}</Banner> : null}
    </Sheet>
  )
}
