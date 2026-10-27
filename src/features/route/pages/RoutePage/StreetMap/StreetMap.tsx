import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { directionsUrl, placeQuery, type Point, type TravelMode } from '@/domain/route'
import { STOP_TONE_LABEL, stopTone, type StopTone } from '@/domain/visit'
import type { Visit } from '@/features/workday/api/queries'
import { placeName } from '../stop'
import { RouteSketch } from '../RouteSketch'
import styles from './StreetMap.module.scss'

// OpenFreeMap: OpenStreetMap streets, free and without a key (attribution shown on the map).
const STYLE = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }

interface StreetMapProps {
  stops: Visit[]
  origin: Point | null
  /** The path by streets as [lng, lat]; without it the stops are joined in straight lines. */
  line: [number, number][] | null
  mode: TravelMode
  /** Show how each stop is going, in the colors of the status chips (done green, in progress blue...). */
  progress?: boolean
}

const TONE: Record<StopTone, string | undefined> = {
  pending: undefined,
  active: styles.current,
  done: styles.done,
  approved: styles.done,
  fix: styles.fix,
  closed: styles.closed,
  refused: styles.refused,
}

/** The route on a real street map: numbered stops to tap, zoom, and the path between them. */
export default function StreetMap({ stops, origin, line, mode, progress = false }: StreetMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const located = stops.filter((v) => v.store.lat !== null && v.store.lng !== null)

  useEffect(() => {
    const el = box.current
    if (!el || failed || located.length < 1) return
    const dark = document.documentElement.dataset.theme === 'dark'
    const css = getComputedStyle(document.documentElement)
    const color = css.getPropertyValue(dark ? '--lime' : '--forest').trim() || '#173b30'
    const coords: [number, number][] = located.map((v) => [v.store.lng as number, v.store.lat as number])
    const path = line && line.length > 1 ? line : origin ? [[origin.lng, origin.lat] as [number, number], ...coords] : coords

    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: el,
        style: dark ? STYLE.dark : STYLE.light,
        bounds: bounds([...path, ...coords]),
        fitBoundsOptions: { padding: 48, maxZoom: 16 },
        attributionControl: { compact: true },
        // On a phone, one finger scrolls the page; two move the map.
        cooperativeGestures: window.matchMedia('(pointer: coarse)').matches,
        locale: {
          'CooperativeGesturesHandler.WindowsHelpText': 'Usá Ctrl + scroll para acercar el mapa',
          'CooperativeGesturesHandler.MacHelpText': 'Usá ⌘ + scroll para acercar el mapa',
          'CooperativeGesturesHandler.MobileHelpText': 'Usá dos dedos para mover el mapa',
          'NavigationControl.ZoomIn': 'Acercar',
          'NavigationControl.ZoomOut': 'Alejar',
          'NavigationControl.ResetBearing': 'Volver al norte',
        },
      })
    } catch {
      setFailed(true) // no WebGL
      return
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    // The style can't be had (no signal): the sketch takes over. A missing tile later is not a failure.
    map.on('error', () => {
      if (!map.isStyleLoaded()) setFailed(true)
    })

    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path } } })
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.9, ...(line && line.length > 1 ? {} : { 'line-dasharray': [1.5, 1.5] }) },
      })
    })

    if (origin) {
      const me = document.createElement('span')
      me.className = styles.origin ?? ''
      me.setAttribute('aria-label', 'Tu ubicación')
      new maplibregl.Marker({ element: me }).setLngLat([origin.lng, origin.lat]).addTo(map)
    }
    located.forEach((v) => {
      const n = stops.indexOf(v) + 1
      const pin = document.createElement('button')
      pin.type = 'button'
      const tone = stopTone(v.workStatus, v.reviewStatus)
      const state = progress ? TONE[tone] : n === 1 ? styles.first : ''
      pin.className = `${styles.pin ?? ''} ${state ?? ''}`.trim()
      pin.textContent = String(n)
      const said = progress ? `, ${STOP_TONE_LABEL[tone]}` : ''
      pin.setAttribute('aria-label', `${n}. ${placeName(v)}${said}`)
      const popup = new maplibregl.Popup({ offset: 18, closeButton: false, maxWidth: '260px' }).setDOMContent(card(n, v, mode))
      new maplibregl.Marker({ element: pin }).setLngLat([v.store.lng as number, v.store.lat as number]).setPopup(popup).addTo(map)
    })

    return () => map.remove()
    // The parent remounts it (key) when the plan changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed])

  if (failed) return <RouteSketch stops={stops} origin={origin} />
  const missing = stops.length - located.length
  return (
    <div className={styles.wrap}>
      <div ref={box} className={styles.map} role="region" aria-label="Mapa del recorrido" />
      {missing ? <p className={styles.note}>{missing === 1 ? '1 local no tiene ubicación y no está en el mapa.' : `${missing} locales no tienen ubicación y no están en el mapa.`}</p> : null}
    </div>
  )
}

function bounds(points: [number, number][]): [[number, number], [number, number]] {
  const lngs = points.map((p) => p[0])
  const lats = points.map((p) => p[1])
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]
}

/** What a tapped stop shows: its number, name and how to get there. */
function card(n: number, v: Visit, mode: TravelMode) {
  const root = document.createElement('div')
  root.className = styles.card ?? ''
  const title = document.createElement('strong')
  title.textContent = `${n}. ${placeName(v)}`
  root.append(title)
  if (v.store.name) {
    const address = document.createElement('span')
    address.textContent = v.store.address
    root.append(address)
  }
  const go = document.createElement('a')
  go.href = directionsUrl(placeQuery(v.store), mode)
  go.target = '_blank'
  go.rel = 'noreferrer'
  go.className = styles.go ?? ''
  go.textContent = 'Ir con Google Maps'
  root.append(go)
  return root
}
