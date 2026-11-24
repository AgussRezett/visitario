import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, MapPinOff, Search } from 'lucide-react'
import { formatLongDate, todayInArgentina } from '@/domain/dates'
import { supabase } from '@/lib/supabase'
import { useDebounced } from '@/lib/useDebounced'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Segmented } from '@/ui/Segmented'
import { Sheet } from '@/ui/Sheet'
import { Chip } from '@/ui/StatusChip'
import { Select } from '@/ui/Select'
import { ToggleTags } from '@/ui/ToggleTag'
import type { WorkContext } from '@/features/workday/context'
import { useCatalogs } from '@/features/workday/api/queries'
import { useAddVisit } from '@/features/workday/api/mutations'
import { geocode, type GeocodeResult } from '@/features/workday/api/geocode'
import { channelIdOf, channelOptions } from './channel-choice'
import styles from './AddAddressSheet.module.scss'
import { useOnline } from '@/lib/online'
import { SellerPicker } from '@/features/workday/components/SellerPicker'
import { useAddSeller, useCanAddSellers } from '@/features/workday/api/sellers'
import { pickable } from '@/features/workday/store-tags'
import { useDayOverlaps } from '@/features/workday/api/overlaps'
import { OverlapNote } from '@/features/workday/components/OverlapNote'
import { DirectoryResults } from './DirectoryResults'
import { useManyStores } from './useManyStores'

interface AddAddressSheetProps {
  open: boolean
  onClose: () => void
  ctx: WorkContext
  workdayId: string
  date: string
  /** When a supervisor adds to someone's day: their first name, for the copy. */
  forName?: string
}

const EMPTY = { address: '', name: '', customerNumber: '', task: '', displayTypes: [] as number[], channel: null as string | null, seller: null as number | null }

/** Add a store from the directory, a new one, or several at once, reviewed row by row (wireframes A05 / AD06). */
export function AddAddressSheet({ open, onClose, ctx, workdayId, date, forName }: AddAddressSheetProps) {
  const online = useOnline()
  const [mode, setMode] = useState<'one' | 'many'>('one')
  const [query, setQuery] = useState('')
  /** The store being added: marked while it saves, so the tap shows. */
  const [picked, setPicked] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const catalogs = useCatalogs(ctx.companyId)
  const add = useAddVisit(workdayId)

  useEffect(() => {
    if (open) {
      setQuery('')
      setForm(EMPTY)
      add.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the sheet opens
  }, [open])

  const q = useDebounced(query.trim(), 300)
  const found = useQuery({
    queryKey: ['store-search', ctx.companyId, q],
    enabled: open && q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_stores', { p_company: ctx.companyId, p_query: q })
      if (error) throw error
      return data
    },
  })

  const addressQuery = useDebounced(form.address.trim(), 700)
  const located = useQuery({
    queryKey: ['geocode', addressQuery],
    enabled: open && addressQuery.length >= 5,
    staleTime: Infinity,
    queryFn: () => geocode(addressQuery),
  })
  const place: GeocodeResult | undefined = located.data?.[0]

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const sellers = pickable(catalogs.data?.sellers, null)
  const channels = pickable(catalogs.data?.channels, null)
  // A new store's channel is chosen on purpose: a channel, or "Sin canal". Never assumed.
  const formChannel = form.channel ?? ''
  const formNeedsChannel = channels.length > 0 && formChannel === ''
  const canAdd = useCanAddSellers(ctx.companyId)
  const newSeller = useAddSeller(ctx.companyId)
  const addSeller = canAdd ? (name: string) => newSeller.mutateAsync(name) : undefined
  const many = useManyStores({ open, ctx, workdayId, date, online, sellers, channels, onAddSeller: addSeller, onClose })

  // Who else already has these stores that day, before adding them again.
  const when = date === todayInArgentina() ? 'de hoy' : 'de ese día'
  const foundOverlaps = useDayOverlaps(workdayId, (found.data ?? []).map((st) => ({ storeId: st.id })), open && mode === 'one' && online)
  const typed = useDebounced(`${form.address.trim()}|${form.customerNumber.trim()}`, 500).split('|')
  const newOverlaps = useDayOverlaps(workdayId, [{ address: typed[0], customerNumber: typed[1] }], open && mode === 'one' && online)

  const pick = async (storeId: string) => {
    setPicked(storeId)
    try {
      await add.mutateAsync({ storeId })
      onClose()
    } finally {
      setPicked(null)
    }
  }

  const addNew = async () => {
    await add.mutateAsync({
      address: form.address.trim(),
      name: form.name.trim() || undefined,
      customerNumber: form.customerNumber.trim() || undefined,
      task: form.task.trim() || undefined,
      displayTypes: form.displayTypes,
      channelId: channelIdOf(formChannel),
      sellerId: form.seller,
      area: place?.area ?? null,
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      locationStatus: place ? (place.exact ? 'verified' : 'approximate') : 'unverified',
    })
    onClose()
  }

  const canAddNew = form.address.trim().length >= 3 && !formNeedsChannel

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={forName ? `Agregar a la jornada de ${forName}` : 'Agregar a mi jornada'}
      subtitle={formatLongDate(date)}
      footer={
        mode === 'one' ? (
          <>
            <Button variant="secondary" size="md" className={styles.cancel} onClick={onClose}>Cancelar</Button>
            <Button size="md" disabled={!canAddNew || !online} loading={add.isPending} onClick={addNew}>{forName ? 'Agregar a la jornada' : 'Agregar a mi jornada'}</Button>
          </>
        ) : many.footer
      }
    >
      {online ? null : <Banner tone="info">Sin señal: para buscar y agregar direcciones necesitás conexión. Las visitas que ya tenés siguen funcionando.</Banner>}
      {mode === 'many' && many.step === 'review' ? null : <Segmented
        label="Cómo agregar"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'one', label: 'Una dirección' },
          { value: 'many', label: 'Pegar varias' },
        ]}
      />}

      {mode === 'one' ? (
        <>
          <div className={styles.block}>
            <label className={styles.search}>
              <Search size={18} aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar comercio, dirección o nro. de cliente" aria-label="Buscar en el directorio" />
            </label>
            {found.data?.length ? (
              <DirectoryResults stores={found.data} picked={picked} busy={add.isPending} onPick={(id) => void pick(id)} overlaps={foundOverlaps.data} when={when} />
            ) : q.length >= 2 && found.isSuccess ? (
              <p className={styles.help}>No está en el directorio. Cargalo como comercio nuevo.</p>
            ) : null}
          </div>

          <div className={styles.divider}><span />o un comercio nuevo<span /></div>

          <div className={styles.newStore}>
            <div className={styles.block}>
              <Field label="Dirección" value={form.address} onChange={set('address')} placeholder="Ej.: Cabildo 2245" autoComplete="off" />
              {form.address.trim().length >= 5 && !located.isFetching && addressQuery === form.address.trim() ? (
                place?.exact ? (
                  <Chip tone="done" className={styles.locChip} icon={<Check size={14} strokeWidth={3} aria-hidden />}>
                    Calle y altura verificadas{place.area ? ` · ${place.area}` : ''}
                  </Chip>
                ) : place ? (
                  <Chip tone="closed" className={styles.locChip}>Ubicación aproximada{place.area ? ` · ${place.area}` : ''}</Chip>
                ) : (
                  <span className={styles.noLocation}><MapPinOff size={14} aria-hidden />Sin ubicación: se guarda igual y la verificás después</span>
                )
              ) : null}
              {typed[0] === form.address.trim() ? <OverlapNote list={newOverlaps.data?.get(0)} when={when} /> : null}
            </div>
            <div className={styles.pair}>
              <Field label="Nombre" value={form.name} onChange={set('name')} placeholder="Opcional" />
              <Field label="Nro. de cliente" value={form.customerNumber} onChange={set('customerNumber')} placeholder="Opcional" inputMode="numeric" />
            </div>
            <div className={styles.pair}>
              {channels.length ? (
                <Select label="Canal" value={formChannel} onChange={(v) => setForm((f) => ({ ...f, channel: v }))} placeholder="Elegí uno" options={channelOptions(channels)} />
              ) : null}
              <SellerPicker sellers={sellers} value={form.seller} onChange={(seller) => setForm((f) => ({ ...f, seller }))} onAddSeller={addSeller} />
            </div>
            {formNeedsChannel && form.address.trim().length >= 3 ? <p className={styles.help}>Para agregarlo, elegí el canal (o "Sin canal").</p> : null}
            <Field label="Tarea" value={form.task} onChange={set('task')} placeholder="Opcional" />
            {catalogs.data?.displayTypes.length ? (
              <div className={styles.block}>
                <span className={styles.label}>Exhibiciones que esperás</span>
                <ToggleTags
                  label="Exhibiciones que esperás"
                  options={catalogs.data.displayTypes.map((t) => ({ value: t.id, label: t.name }))}
                  selected={form.displayTypes}
                  onToggle={(id) =>
                    setForm((f) => ({ ...f, displayTypes: f.displayTypes.includes(id) ? f.displayTypes.filter((x) => x !== id) : [...f.displayTypes, id] }))
                  }
                />
              </div>
            ) : null}
          </div>
        </>
      ) : many.body}

      {add.error ? <Banner tone="error">{add.error.message}</Banner> : null}
      <p className={styles.help}>
        Queda registrada como agregada por vos y tu supervisor la ve en tu jornada. Si no encontramos la altura exacta, la guardás sin ubicación y la verificás después.
      </p>
    </Sheet>
  )
}
