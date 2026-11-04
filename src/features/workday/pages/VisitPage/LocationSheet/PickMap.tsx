import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import styles from './LocationSheet.module.scss'

// OpenFreeMap: OpenStreetMap streets, free and without a key (attribution shown on the map).
const STYLE = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }
const CITY = { lat: -34.6037, lng: -58.3816 }

interface PickMapProps {
  /** Where the pin is; the map flies there when it changes from outside (GPS, a search). */
  point: { lat: number; lng: number } | null
  /** The pin stays in the middle: moving the map moves it. */
  onMove: (point: { lat: number; lng: number }) => void
}

/** A map with a fixed pin in the middle: the person moves the map until the pin is on the store. */
export default function PickMap({ point, onMove }: PickMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const last = useRef(point)
  const [failed, setFailed] = useState(false)
  const moved = useRef(onMove)
  moved.current = onMove

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
    // Only moves the person made count (a fly-to from outside already set the point).
    m.on('moveend', (e) => {
      if (!(e as { originalEvent?: unknown }).originalEvent) return
      const c = m.getCenter()
      const next = { lat: Math.round(c.lat * 1e6) / 1e6, lng: Math.round(c.lng * 1e6) / 1e6 }
      last.current = next
      moved.current(next)
    })
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [failed])

  // A new point from outside: the map goes there.
  useEffect(() => {
    if (!point || (last.current && last.current.lat === point.lat && last.current.lng === point.lng)) return
    last.current = point
    map.current?.flyTo({ center: [point.lng, point.lat], zoom: 17, duration: 600 })
  }, [point])

  if (failed) return <p className={styles.note}>No pudimos mostrar el mapa en este dispositivo. Usá "Estoy en el local" o buscá la dirección.</p>
  return (
    <div className={styles.mapWrap}>
      <div ref={box} className={styles.map} role="region" aria-label="Mapa para ubicar el local: movelo hasta que el pin quede sobre la puerta" />
      <span className={styles.pin} aria-hidden />
    </div>
  )
}
