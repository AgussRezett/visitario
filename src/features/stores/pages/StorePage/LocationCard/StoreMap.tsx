import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import styles from './LocationCard.module.scss'

// OpenFreeMap: OpenStreetMap streets, free and without a key (attribution shown on the map).
const STYLE = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }
const ZOOM = 16

interface StoreMapProps {
  lat: number
  lng: number
  label: string
  /** Approximate: the street is right, the exact spot may not be. */
  approximate: boolean
}

/** The store on a street map, its pin in the middle. Moves with the location when it is checked again. */
export default function StoreMap({ lat, lng, label, approximate }: StoreMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const pin = useRef<maplibregl.Marker | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el || failed) return
    const dark = document.documentElement.dataset.theme === 'dark'
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({
        container: el,
        style: dark ? STYLE.dark : STYLE.light,
        center: [lng, lat],
        zoom: ZOOM,
        attributionControl: { compact: true },
        // On a phone, one finger scrolls the page; two move the map.
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
    const dot = document.createElement('div')
    dot.className = styles.pin ?? ''
    dot.setAttribute('role', 'img')
    pin.current = new maplibregl.Marker({ element: dot }).setLngLat([lng, lat]).addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
      pin.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- made once; the location moves below
  }, [failed])

  // Checked again: the pin and the view follow.
  useEffect(() => {
    pin.current?.setLngLat([lng, lat])
    map.current?.easeTo({ center: [lng, lat], zoom: ZOOM, duration: 500 })
  }, [lat, lng])

  useEffect(() => {
    const el = pin.current?.getElement()
    if (!el) return
    el.dataset.approximate = approximate ? 'true' : 'false'
    el.setAttribute('aria-label', `${label}${approximate ? ' (ubicación aproximada)' : ''}`)
  }, [label, approximate, failed])

  if (failed) return <p className={styles.mapNote}>No pudimos mostrar el mapa en este dispositivo.</p>
  return <div ref={box} className={styles.map} role="region" aria-label={`Mapa: ${label}`} />
}
