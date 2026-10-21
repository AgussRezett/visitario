import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { isVisited } from '@/domain/visit'
import type { Presence } from '@/domain/operations'
import type { Visit } from '@/features/workday/api/queries'
import styles from './TeamMap.module.scss'

const STYLE = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }
const BUENOS_AIRES: [number, number] = [-58.44, -34.6]

interface TeamMapProps {
  stops: Visit[]
  /** Members sharing their location. */
  people: Presence[]
  meId: string
}

const place = (v: Visit) => v.store.name ?? v.store.address

/** The operativo on a street map: its stops (done in green) and where each member is. */
export default function TeamMap({ stops, people, meId }: TeamMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef(new Map<string, maplibregl.Marker>())
  const [failed, setFailed] = useState(false)
  const located = stops.filter((v) => v.store.lat !== null && v.store.lng !== null)
  const sharing = people.filter((p) => p.lat !== null && p.lng !== null)

  useEffect(() => {
    const el = box.current
    if (!el || failed) return
    const dark = document.documentElement.dataset.theme === 'dark'
    const points: [number, number][] = [
      ...located.map((v) => [v.store.lng as number, v.store.lat as number] as [number, number]),
      ...sharing.map((p) => [p.lng as number, p.lat as number] as [number, number]),
    ]
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({
        container: el,
        style: dark ? STYLE.dark : STYLE.light,
        ...(points.length ? { bounds: bounds(points), fitBoundsOptions: { padding: 48, maxZoom: 16 } } : { center: BUENOS_AIRES, zoom: 11 }),
        attributionControl: { compact: true },
        cooperativeGestures: window.matchMedia('(pointer: coarse)').matches,
        locale: {
          'CooperativeGesturesHandler.WindowsHelpText': 'Usá Ctrl + scroll para acercar el mapa',
          'CooperativeGesturesHandler.MacHelpText': 'Usá ⌘ + scroll para acercar el mapa',
          'CooperativeGesturesHandler.MobileHelpText': 'Usá dos dedos para mover el mapa',
          'NavigationControl.ZoomIn': 'Acercar',
          'NavigationControl.ZoomOut': 'Alejar',
        },
      })
    } catch {
      setFailed(true) // no WebGL
      return
    }
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('error', () => {
      if (!m.isStyleLoaded()) setFailed(true)
    })
    located.forEach((v, i) => {
      const pin = document.createElement('span')
      pin.className = `${styles.stop ?? ''} ${isVisited(v.workStatus) ? styles.done ?? '' : ''}`
      pin.textContent = String(i + 1)
      pin.setAttribute('aria-label', `${i + 1}. ${place(v)}${isVisited(v.workStatus) ? ', hecho' : ''}`)
      new maplibregl.Marker({ element: pin }).setLngLat([v.store.lng as number, v.store.lat as number])
        .setPopup(new maplibregl.Popup({ offset: 16, closeButton: false }).setText(`${i + 1}. ${place(v)}`)).addTo(m)
    })
    map.current = m
    const people = markers.current
    return () => {
      people.clear()
      m.remove()
      map.current = null
    }
    // Stops are drawn once per opening; people move below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed])

  // People move without redrawing the map.
  useEffect(() => {
    const m = map.current
    if (!m) return
    const seen = new Set<string>()
    for (const p of sharing) {
      seen.add(p.personId)
      const at: [number, number] = [p.lng as number, p.lat as number]
      const found = markers.current.get(p.personId)
      if (found) {
        found.setLngLat(at)
        continue
      }
      const dot = document.createElement('span')
      dot.className = `${styles.person ?? ''} ${p.personId === meId ? styles.me ?? '' : ''}`
      dot.textContent = p.firstName.slice(0, 1).toUpperCase()
      dot.setAttribute('aria-label', p.personId === meId ? 'Vos' : p.firstName)
      dot.title = p.personId === meId ? 'Vos' : p.firstName
      markers.current.set(p.personId, new maplibregl.Marker({ element: dot }).setLngLat(at).addTo(m))
    }
    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove()
        markers.current.delete(id)
      }
    }
  }, [sharing, meId])

  if (failed) return <p className={styles.note}>No pudimos mostrar el mapa en este celular.</p>
  return (
    <div className={styles.wrap}>
      <div ref={box} className={styles.map} role="region" aria-label="Mapa del operativo" />
      <p className={styles.note}>
        {sharing.length ? `${sharing.length === 1 ? '1 persona comparte' : `${sharing.length} personas comparten`} su ubicación.` : 'Nadie comparte su ubicación ahora.'}
        {stops.length > located.length ? ` ${stops.length - located.length} sin ubicación no están en el mapa.` : ''}
      </p>
    </div>
  )
}

function bounds(points: [number, number][]): [[number, number], [number, number]] {
  const lngs = points.map((p) => p[0])
  const lats = points.map((p) => p[1])
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]
}
