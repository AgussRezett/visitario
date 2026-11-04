import { lazy, Suspense, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Crosshair, Search } from 'lucide-react'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { Skeleton } from '@/ui/Skeleton'
import type { Visit } from '@/features/workday/api/queries'
import { fixStoreLocation, geocode, positionHere, type GeocodeResult } from '@/features/workday/api/geocode'
import styles from './LocationSheet.module.scss'

const PickMap = lazy(() => import('./PickMap'))

type Point = { lat: number; lng: number }
/** Past this many metres the phone's position is too rough to trust for the door. */
const ROUGH_GPS = 60

/**
 * The activador checks where a store of their day landed and fixes it: at the door with the
 * phone's GPS, by searching the address again (the street number, usually), or by moving the
 * map under the pin. Only the location and the address; the rest of the store is not theirs.
 */
export function LocationSheet({ visit: v, open, onClose }: { visit: Visit; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const s = v.store
  const start = s.lat !== null && s.lng !== null ? { lat: s.lat, lng: s.lng } : null
  const [point, setPoint] = useState<Point | null>(start)
  const [address, setAddress] = useState(s.address)
  const [results, setResults] = useState<GeocodeResult[] | null>(null)
  const [note, setNote] = useState<{ tone: 'info' | 'warn' | 'error'; text: string } | null>(null)
  const [locating, setLocating] = useState(false)
  const [searching, setSearching] = useState(false)
  const moved = point !== null && (point.lat !== start?.lat || point.lng !== start?.lng)
  const renamed = address.trim() !== s.address && address.trim().length >= 3

  const save = useMutation({
    mutationFn: () => fixStoreLocation(s.id, point as Point, renamed ? address.trim() : undefined),
    onSuccess: () => {
      const store = { ...s, lat: point?.lat ?? null, lng: point?.lng ?? null, locationStatus: 'verified' as const, address: renamed ? address.trim() : s.address }
      const patch = (x: Visit) => (x.store.id === s.id ? { ...x, store } : x)
      qc.setQueriesData<Visit[]>({ queryKey: ['workday', 'visits'] }, (list) => list?.map(patch))
      qc.setQueriesData<Visit | null>({ queryKey: ['workday', 'visit', v.id] }, (x) => (x ? patch(x) : x))
      void qc.invalidateQueries({ queryKey: ['workday'] })
      void qc.invalidateQueries({ queryKey: ['stores'] })
      onClose()
    },
  })

  const here = async () => {
    setLocating(true)
    setNote(null)
    try {
      const p = await positionHere()
      setPoint({ lat: p.lat, lng: p.lng })
      setNote(p.accuracy > ROUGH_GPS
        ? { tone: 'warn', text: `El GPS marca con ±${Math.round(p.accuracy)} m de error. Si el pin no quedó en la puerta, mové el mapa.` }
        : { tone: 'info', text: 'Listo: el pin quedó donde estás. Si no es la puerta, mové el mapa.' })
    } catch {
      setNote({ tone: 'error', text: 'No pudimos saber dónde estás. Revisá que Visitario tenga permiso de ubicación.' })
    } finally {
      setLocating(false)
    }
  }

  const search = async () => {
    setSearching(true)
    setNote(null)
    const found = await geocode(address, 'caba', s.area)
    setSearching(false)
    setResults(found.slice(0, 4))
    if (!found.length) setNote({ tone: 'warn', text: 'No la encontramos. Revisá la calle y la altura, o ubicala con el mapa.' })
  }

  const pick = (r: GeocodeResult) => {
    setPoint({ lat: r.lat, lng: r.lng })
    setResults(null)
    setNote(r.exact ? null : { tone: 'warn', text: 'Encontramos la calle pero no la altura exacta: acomodá el pin en la puerta.' })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Revisar ubicación" subtitle={s.name ?? s.address}
      footer={<>
        <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
        <Button size="md" disabled={!point || (!moved && !renamed && s.locationStatus === 'verified')} loading={save.isPending} onClick={() => save.mutate()}>Guardar ubicación</Button>
      </>}>
      <div className={styles.body}>
        <Button variant="secondary" onClick={() => void here()} loading={locating}><Crosshair size={20} aria-hidden />Estoy en el local</Button>
        <Suspense fallback={<Skeleton height={260} />}>
          <PickMap point={point} onMove={(p) => { setPoint(p); setNote(null) }} />
        </Suspense>
        <p className={styles.help}>{point ? 'Mové el mapa hasta que el pin quede sobre la puerta del local.' : 'Todavía no sabemos dónde está: usá tu ubicación, buscá la dirección o mové el mapa.'}</p>
        {note ? <Banner tone={note.tone}>{note.text}</Banner> : null}

        <form className={styles.search} onSubmit={(e) => { e.preventDefault(); void search() }}>
          <Field label="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} autoComplete="off"
            help={renamed ? 'Se guarda con la dirección corregida.' : 'Si la altura está mal, corregila y buscala de nuevo.'} />
          <Button type="submit" variant="secondary" size="md" loading={searching} disabled={address.trim().length < 4} className={styles.searchButton}><Search size={18} aria-hidden />Buscar</Button>
        </form>
        {results?.length ? (
          <ul className={styles.results} aria-label="Lugares encontrados">
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" className={styles.result} onClick={() => pick(r)}>
                  <span className={styles.resultName}>{r.address}</span>
                  <span className={styles.resultNote}>{[r.area, r.exact ? 'con la altura' : 'solo la calle'].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {save.error ? <Banner tone="error">{save.error.message}</Banner> : null}
      </div>
    </Sheet>
  )
}
