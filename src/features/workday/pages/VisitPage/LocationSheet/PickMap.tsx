import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import styles from './LocationSheet.module.scss'

// OpenFreeMap: OpenStreetMap streets, free and without a key (attribution shown on the map).
const STYLE = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }
const CITY = { lat: -34.6037, lng: -58.3816 }

type Point = { lat: number; lng: number }

interface PickMapProps {
  /** Where the pin is; the map flies there when it changes from outside (GPS, a search). */
  point: Point | null
  /** The person put the pin somewhere else: dragged it, or tapped the map. */
  onMove: (point: Point) => void
}

const rounded = (p: { lat: number; lng: number }): Point => ({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 })

/**
 * A map with the store's pin on its spot: moving or zooming the map only looks around. The
 * pin moves when dragged, or to where the map is tapped.
 */
export default function PickMap({ point, onMove }: PickMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const pin = useRef<maplibregl.Marker | null>(null)
  const last = useRef(point)
  const [failed, setFailed] = useState(false)
  const moved = useRef(onMove)
  moved.current = onMove

  // The pin at a point, made the first time it is needed.
  const place = (m: maplibregl.Map, p: Point) => {
    if (!pin.current) {
      const dot = document.createElement('div')
      dot.className = styles.pin ?? ''
      dot.setAttribute('role', 'img')
      dot.setAttribute('aria-label', 'Ubicación del local')
      pin.current = new maplibregl.Marker({ element: dot, draggable: true }).setLngLat([p.lng, p.lat]).addTo(m)
      pin.current.on('dragend', () => {
        const at = pin.current?.getLngLat()
        if (!at) return
        last.current = rounded(at)
        moved.current(last.current)
      })
    } else {
      pin.current.setLngLat([p.lng, p.lat])
    }
  }

  useEffect(() => {
    const el = box.current
    if (!el || failed) return
    const dark = document.documentElement.dataset.theme === 'dark'
    const start = last.current ?? CITY
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({
        container: el,
        style: dark ? STYLE.dark : STYLE.light,
        center: [start.lng, start.lat],
        zoom: last.current ? 17 : 12,
        attributionControl: { compact: true },
        dragRotate: false,
        locale: { 'NavigationControl.ZoomIn': 'Acercar', 'NavigationControl.ZoomOut': 'Alejar' },
      })
    } catch {
      setFailed(true) // no WebGL
      return
    }
    m.touchZoomRotate.disableRotation()
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('error', () => {
      if (!m.isStyleLoaded()) setFailed(true)
    })
    // A tap puts the pin there (a drag of the map is not a tap: it only looks around).
    m.on('click', (e) => {
      last.current = rounded(e.lngLat)
      place(m, last.current)
      moved.current(last.current)
    })
    if (last.current) place(m, last.current)
    map.current = m
    return () => {
      m.remove()
      map.current = null
      pin.current = null
    }
  }, [failed])

  // A new point from outside (GPS, a search): the pin and the view go there.
  useEffect(() => {
    if (!point || (last.current && last.current.lat === point.lat && last.current.lng === point.lng)) return
    last.current = point
    const m = map.current
    if (!m) return
    place(m, point)
    m.flyTo({ center: [point.lng, point.lat], zoom: 17, duration: 600 })
  }, [point])

  if (failed) return <p className={styles.note}>No pudimos mostrar el mapa en este dispositivo. Usá "Estoy en el local" o buscá la dirección.</p>
  return (
    <div className={styles.mapWrap}>
      <div ref={box} className={styles.map} role="region" aria-label="Mapa para ubicar el local: arrastrá el pin o tocá donde está la puerta" />
    </div>
  )
}
