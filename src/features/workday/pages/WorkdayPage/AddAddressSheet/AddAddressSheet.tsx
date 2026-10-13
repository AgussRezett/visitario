import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, MapPinOff, Plus, Search, Store } from 'lucide-react'
import { formatLongDate } from '@/domain/dates'
import { parseLine } from '@/domain/import'
import { supabase } from '@/lib/supabase'
import { useDebounced } from '@/lib/useDebounced'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Segmented } from '@/ui/Segmented'
import { Sheet } from '@/ui/Sheet'
import { Chip } from '@/ui/StatusChip'
import { TextArea } from '@/ui/TextArea'
import { ToggleTags } from '@/ui/ToggleTag'
import type { WorkContext } from '@/features/workday/context'
import { useCatalogs } from '@/features/workday/api/queries'
import { useAddVisit } from '@/features/workday/api/mutations'
import { geocode, type GeocodeResult } from '@/features/workday/api/geocode'
import styles from './AddAddressSheet.module.scss'
import { useOnline } from '@/lib/online'

interface AddAddressSheetProps {
  open: boolean
  onClose: () => void
  ctx: WorkContext
  workdayId: string
  date: string
  /** When a supervisor adds to someone's day: their first name, for the copy. */
  forName?: string
}

const EMPTY = { address: '', name: '', customerNumber: '', task: '', displayTypes: [] as number[] }

/** Add a store from the directory, a new one, or several pasted addresses (wireframes A05 / AD06). */
export function AddAddressSheet({ open, onClose, ctx, workdayId, date, forName }: AddAddressSheetProps) {
  const online = useOnline()
  const [mode, setMode] = useState<'one' | 'many'>('one')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [pasted, setPasted] = useState('')
  const [progress, setProgress] = useState<string | null>(null)
  const [leftOut, setLeftOut] = useState<string | null>(null)
  const [pasting, setPasting] = useState(false)
  const catalogs = useCatalogs(ctx.companyId)
  const add = useAddVisit(workdayId)

  useEffect(() => {
    if (open) {
      setQuery('')
      setForm(EMPTY)
      setPasted('')
      setProgress(null)
      setLeftOut(null)
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

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))
  // A store per line: "12345; Tres Arroyos 762; Paternal", parts in any order (; , or tab)
  const lines = pasted.split('\n').map((l) => l.trim()).filter(Boolean).map((text) => ({ text, ...parseLine(text) })).filter((l) => l.address || l.customerNumber)

  const addNew = async () => {
    await add.mutateAsync({
      address: form.address.trim(),
      name: form.name.trim() || undefined,
      customerNumber: form.customerNumber.trim() || undefined,
      task: form.task.trim() || undefined,
      displayTypes: form.displayTypes,
      area: place?.area ?? null,
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      locationStatus: place ? (place.exact ? 'verified' : 'approximate') : 'unverified',
    })
    onClose()
  }

  const addPasted = async () => {
    setPasting(true)
    try {
      await addLines()
    } finally {
      setPasting(false)
    }
  }

  const addLines = async () => {
    setLeftOut(null)
    setProgress('Buscando en el directorio…')
    // Stores already in the directory are reused (by customer number, then address).
    const { data: found } = await supabase.rpc('match_stores', {
      p_company: ctx.companyId,
      p_rows: lines.map((l) => ({ customer_number: l.customerNumber, address: l.address })),
    })
    const known = new Map((found ?? []).map((m) => [m.idx, m.store_id]))
    const missing: string[] = []
    for (const [i, l] of lines.entries()) {
      setProgress(`Agregando ${i + 1} de ${lines.length}…`)
      const storeId = known.get(i)
      if (storeId) await add.mutateAsync({ storeId })
      else if (l.address.length >= 3) await add.mutateAsync({ address: l.address, customerNumber: l.customerNumber || undefined, area: l.area || null })
      else missing.push(l.text)
    }
    if (!missing.length) return onClose()
    // Only a customer number nobody knows: keep those lines for the merchandiser to complete.
    setPasted(missing.join('\n'))
    setLeftOut(`${missing.length === 1 ? 'Este cliente no está' : 'Estos clientes no están'} en el directorio: sumá la dirección en la misma línea.`)
  }

  const canAddNew = form.address.trim().length >= 3

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={forName ? `Agregar a la jornada de ${forName}` : 'Agregar a mi jornada'}
      subtitle={formatLongDate(date)}
      footer={
        <>
          <Button variant="secondary" size="md" className={styles.cancel} onClick={onClose}>Cancelar</Button>
          {mode === 'one' ? (
            <Button size="md" disabled={!canAddNew || !online} loading={add.isPending} onClick={addNew}>{forName ? 'Agregar a la jornada' : 'Agregar a mi jornada'}</Button>
          ) : (
            <Button size="md" disabled={!lines.length || !online} loading={pasting} onClick={addPasted}>
              Agregar {lines.length || ''} {lines.length === 1 ? 'dirección' : 'direcciones'}
            </Button>
          )}
        </>
      }
    >
      {online ? null : <Banner tone="info">Sin señal: para buscar y agregar direcciones necesitás conexión. Las visitas que ya tenés siguen funcionando.</Banner>}
      <Segmented
        label="Cómo agregar"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'one', label: 'Una dirección' },
          { value: 'many', label: 'Pegar varias' },
        ]}
      />

      {mode === 'one' ? (
        <>
          <div className={styles.block}>
            <label className={styles.search}>
              <Search size={18} aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar comercio, dirección o nro. de cliente" aria-label="Buscar en el directorio" />
            </label>
            {found.data?.length ? (
              <>
                <span className={styles.eyebrow}>En el directorio</span>
                {found.data.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={styles.result}
                    disabled={add.isPending}
                    onClick={async () => {
                      await add.mutateAsync({ storeId: s.id })
                      onClose()
                    }}
                  >
                    <span className={styles.resultIcon}><Store size={16} aria-hidden /></span>
                    <span className={styles.resultText}>
                      <span className={styles.resultName}>{s.name ?? s.address}</span>
                      <span className={styles.resultMeta}>
                        {[s.name ? s.address : s.area, s.customer_number && `Cliente ${s.customer_number}`].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <Plus size={20} className={styles.resultAdd} aria-label="Agregar" />
                  </button>
                ))}
              </>
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
            </div>
            <div className={styles.pair}>
              <Field label="Nombre" value={form.name} onChange={set('name')} placeholder="Opcional" />
              <Field label="Nro. de cliente" value={form.customerNumber} onChange={set('customerNumber')} placeholder="Opcional" inputMode="numeric" />
            </div>
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
      ) : (
        <>
          <TextArea
            label="Direcciones"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={8}
            placeholder={'Una por línea. Nro. de cliente y zona, si los tenés:\n20114; Amenábar 1260; Belgrano\nMoldes 1365'}
            help={pastedHelp(lines)}
          />
          {leftOut ? <Banner tone="warn">{leftOut}</Banner> : null}
        </>
      )}

      {progress && pasting ? <p className={styles.help}>{progress}</p> : null}
      {add.error ? <Banner tone="error">{add.error.message}</Banner> : null}
      <p className={styles.help}>
        Queda registrada como agregada por vos y tu supervisor la ve en tu jornada. Si no encontramos la altura exacta, la guardás sin ubicación y la verificás después.
      </p>
    </Sheet>
  )
}

/** "3 locales · 2 con nro. de cliente · 1 con zona", as the merchandiser types. */
function pastedHelp(lines: { customerNumber: string; area: string }[]) {
  if (!lines.length) return 'Separá con ; o coma, en cualquier orden. Los nuevos se agregan sin ubicación; los verificás después.'
  const withNumber = lines.filter((l) => l.customerNumber).length
  const withArea = lines.filter((l) => l.area).length
  const parts = [`${lines.length} ${lines.length === 1 ? 'local' : 'locales'}`]
  if (withNumber) parts.push(`${withNumber} con nro. de cliente`)
  if (withArea) parts.push(`${withArea} con zona`)
  return `${parts.join(' · ')}. Los que ya están en el directorio se reconocen.`
}
