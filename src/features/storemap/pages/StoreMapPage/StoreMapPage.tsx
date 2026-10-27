import { lazy, Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SlidersHorizontal, Search, X } from 'lucide-react'
import { todayInArgentina } from '@/domain/dates'
import { applyFilters, areasOf, colorsFor, insights, NO_FILTERS, NONE_COLOR, painter, rankByPoints, zoneOf, type ColorBy, type MapFilters } from '@/domain/store-map'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Segmented } from '@/ui/Segmented'
import { Select } from '@/ui/Select'
import { Skeleton } from '@/ui/Skeleton'
import { Switch } from '@/ui/Switch'
import { useIsDesktop } from '@/lib/useMedia'
import { readLocal, writeLocal } from '@/lib/storage'
import { useMe } from '@/features/auth/me'
import { useActiveRole } from '@/features/auth/active-role'
import { useCatalogs } from '@/features/workday/api/queries'
import { useWorkContext } from '@/features/workday/context'
import { storeMapQuery } from '@/features/storemap/api'
import { InsightsPanel } from '@/features/storemap/components/InsightsPanel'
import { PointSheet } from '@/features/storemap/components/PointSheet'
import type { Zone } from '@/features/storemap/components/PointsMap/layers'
import styles from './StoreMapPage.module.scss'

const PointsMap = lazy(() => import('@/features/storemap/components/PointsMap/PointsMap'))

// Grouping near points is a per-device choice, remembered.
const GROUPED_KEY = 'visitario.map.grouped'

const COLOR_OPTIONS: { value: ColorBy; label: string; seller?: boolean }[] = [
  { value: 'seller', label: 'Vendedor', seller: true },
  { value: 'recency', label: 'Última visita' },
  { value: 'channel', label: 'Canal' },
  { value: 'rapport', label: 'Trato' },
]

/** The points of sale on a map: by seller, by how recently they were activated, by channel or by treatment. */
export function StoreMapPage({ point }: { point?: string }) {
  const ctx = useWorkContext()
  const { data: me } = useMe()
  const role = useActiveRole(me)?.role
  const asSeller = role === 'seller'
  const companyId = ctx?.companyId ?? ''
  const today = todayInArgentina()
  const data = useQuery({ ...storeMapQuery(companyId), enabled: Boolean(ctx) })
  const catalogs = useCatalogs(companyId).data
  const [by, setBy] = useState<ColorBy>(asSeller ? 'recency' : 'seller')
  const [zones, setZones] = useState(true)
  const [grouped, setGrouped] = useState(() => readLocal(GROUPED_KEY) !== 'off')
  const [f, setF] = useState<MapFilters>(NO_FILTERS)
  const [selected, setSelected] = useState<string | null>(point ?? null)
  // On phones the filters fold away, so the map comes first.
  const desktop = useIsDesktop()
  const [open, setOpen] = useState(false)

  const sellers = useMemo(() => [...(catalogs?.sellers ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((s) => ({ id: s.id, name: s.name })), [catalogs])
  const channels = useMemo(() => (catalogs?.channels ?? []).map((c) => ({ id: c.id, name: c.name })), [catalogs])
  const all = useMemo(() => data.data ?? [], [data.data])
  const shown = useMemo(() => applyFilters(all, f, today), [all, f, today])
  const located = useMemo(() => shown.filter((p) => p.lat !== null && p.lng !== null), [shown])
  // Colors for the ones with the most points (counted before filtering, so they stay put).
  const sellerRank = useMemo(() => rankByPoints(sellers, all, (p) => p.sellerId), [sellers, all])
  const channelRank = useMemo(() => rankByPoints(channels, all, (p) => p.channelId), [channels, all])
  const paint = useMemo(() => painter(by, today, sellerRank, channelRank), [by, today, sellerRank, channelRank])
  const sellerColor = useMemo(() => colorsFor(sellerRank), [sellerRank])
  const facts = useMemo(() => insights(shown, sellers, today), [shown, sellers, today])
  const zoneList = useMemo((): Zone[] => {
    if (asSeller || by !== 'seller' || !zones) return []
    return sellers.flatMap((s) => {
      const mine = located.filter((p) => p.sellerId === s.id).map((p) => [p.lng as number, p.lat as number] as [number, number])
      return mine.length ? [{ key: String(s.id), label: s.name, color: sellerColor.get(s.id) ?? NONE_COLOR, ring: zoneOf(mine) }] : []
    })
  }, [asSeller, by, zones, sellers, located, sellerColor])

  if (!ctx) return null
  const group = (on: boolean) => {
    setGrouped(on)
    writeLocal(GROUPED_KEY, on ? null : 'off')
  }
  const set = (patch: Partial<MapFilters>) => setF((x) => ({ ...x, ...patch }))
  const areas = areasOf(all)
  const filtered = JSON.stringify(f) !== JSON.stringify(NO_FILTERS)
  const active = [f.area, f.sellerId, f.channelId].filter((x) => x !== null).length + (f.staleOnly ? 1 : 0) + (f.query.trim().length >= 2 ? 1 : 0)
  const current = all.find((p) => p.id === selected) ?? null
  const nameOf = (list: { id: number; name: string }[], id: number | null) => (id === null ? null : list.find((x) => x.id === id)?.name ?? null)
  const options = COLOR_OPTIONS.filter((o) => !(o.seller && asSeller))

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <span className={styles.eyebrow}>{ctx.companyName}{asSeller ? ' · vendedor' : ''}</span>
        <h1 className={styles.title}>{asSeller ? 'Mapa de mis clientes' : 'Mapa de puntos de venta'}</h1>
        {data.data ? <p className={styles.lead}>{shown.length === all.length ? `${all.length} puntos` : `${shown.length} de ${all.length} puntos`}</p> : null}
      </header>

      <section className={styles.controls} aria-label="Filtros del mapa">
        <Segmented label="Pintar por" value={by} onChange={setBy} options={options} />
        {!desktop ? (
          <Button variant="secondary" size="md" className={styles.filtersToggle} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <SlidersHorizontal size={18} aria-hidden />{active ? `Filtros · ${active}` : 'Filtros'}
          </Button>
        ) : null}
        {desktop || open ? (<>
        <div className={styles.filters}>
          <Select label="Zona" value={f.area ?? ''} onChange={(e) => set({ area: e.target.value || null })} options={[{ value: '', label: 'Todas' }, ...areas.map((a) => ({ value: a, label: a }))]} />
          {!asSeller ? (
            <Select label="Vendedor" value={f.sellerId ?? ''} onChange={(e) => set({ sellerId: e.target.value === '' ? null : Number(e.target.value) })}
              options={[{ value: '', label: 'Todos' }, ...sellers.map((s) => ({ value: s.id, label: s.name })), { value: 0, label: 'Sin vendedor' }]} />
          ) : null}
          <Select label="Canal" value={f.channelId ?? ''} onChange={(e) => set({ channelId: e.target.value === '' ? null : Number(e.target.value) })}
            options={[{ value: '', label: 'Todos' }, ...channels.map((c) => ({ value: c.id, label: c.name })), { value: 0, label: 'Sin canal' }]} />
          <label className={styles.search}>
            <Search size={18} aria-hidden />
            <input value={f.query} onChange={(e) => set({ query: e.target.value })} placeholder="Nombre, dirección o nro." aria-label="Buscar un punto" />
          </label>
        </div>
        <div className={styles.toggles}>
          <Switch checked={f.staleOnly} onChange={(on) => set({ staleOnly: on })}>Solo sin visitar hace +30 días</Switch>
          <Switch checked={grouped} onChange={group}>Agrupar puntos cercanos</Switch>
          {!asSeller && by === 'seller' ? <Switch checked={zones} onChange={setZones}>Zonas de cada vendedor</Switch> : null}
          {filtered ? <Button variant="ghost" size="sm" onClick={() => setF(NO_FILTERS)}><X size={16} aria-hidden />Limpiar filtros</Button> : null}
        </div>
        </>) : null}
      </section>

      {data.isPending ? (
        <Skeleton height={420} />
      ) : data.error ? (
        <Banner tone="error">No pudimos cargar el mapa. Revisá la conexión.</Banner>
      ) : !all.length ? (
        <Banner tone="info">{asSeller ? 'Todavía no tenés clientes asignados. Cuando te asignen comercios, los vas a ver acá.' : 'No hay puntos de venta para mostrar.'}</Banner>
      ) : (
        <div className={styles.layout}>
          <div className={styles.mapColumn}>
            <Suspense fallback={<Skeleton height={420} />}>
              <PointsMap points={located} paint={paint} zones={zoneList} selectedId={selected} onSelect={setSelected} grouped={grouped} frameKey={JSON.stringify([f, all.length])} />
            </Suspense>
            <ul className={styles.legend} aria-label="Referencias">
              {paint.legend.map((l) => (
                <li key={l.key} className={styles.legendItem}>
                  {by === 'seller' ? (
                    <button type="button" className={styles.legendButton} onClick={() => set({ sellerId: l.key === 'none' ? 0 : Number(l.key) })} aria-label={`Ver solo ${l.label}`}>
                      <span className={styles.swatch} style={{ background: l.color }} aria-hidden />{l.label}
                    </button>
                  ) : (
                    <><span className={styles.swatch} style={{ background: l.color }} aria-hidden />{l.label}</>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <InsightsPanel
            data={facts}
            bySeller={!asSeller}
            sellerColor={(key) => (key === 'none' ? NONE_COLOR : sellerColor.get(Number(key)) ?? NONE_COLOR)}
            onSeller={(key) => set({ sellerId: key === 'none' ? 0 : Number(key) })}
            onArea={(key) => set({ area: key === 'none' ? null : key })}
          />
        </div>
      )}

      <PointSheet point={current} today={today} asSeller={asSeller} channel={nameOf(channels, current?.channelId ?? null)} seller={nameOf(sellers, current?.sellerId ?? null)} onClose={() => setSelected(null)} />
    </div>
  )
}
