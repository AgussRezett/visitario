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

/**
 * The route on a real street map: numbered stops to tap, zoom, and the path between them.
 * The map loads once; a new order (dragged by hand) redraws the line and the pins in place.
 */
export default function StreetMap({ stops, origin, line, mode, progress = false }: StreetMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<maplibregl.Marker[]>([])
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const located = stops.filter((v) => v.store.lat !== null && v.store.lng !== null)
  const path = pathOf(located, origin, line)
  const byStreet = Boolean(line && line.length > 1)

  useEffect(() => {
    const el = box.current
    if (!el || failed || located.length < 1) return
    const dark = document.documentElement.dataset.theme === 'dark'
    const css = getComputedStyle(document.documentElement)
    const color = css.getPropertyValue(dark ? '--lime' : '--forest').trim() || '#173b30'
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({
        container: el,
        style: dark ? STYLE.dark : STYLE.light,
        bounds: bounds([...path, ...located.map((v) => [v.store.lng as number, v.store.lat as number] as [number, number])]),
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
    map.current = m
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    // The style can't be had (no signal): the sketch takes over. A missing tile later is not a failure.
    m.on('error', () => {
      if (!m.isStyleLoaded()) setFailed(true)
    })
    m.on('load', () => {
      m.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } })
      m.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.9 } })
      setReady(true)
    })
    return () => {
      markers.current = []
      map.current = null
      setReady(false)
      m.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once; the effect below draws
  }, [failed])

  // The line and the pins, drawn again whenever the order, the path or a stop's state changes.
  const drawn = JSON.stringify([path, located.map((v) => v.id + v.workStatus + v.reviewStatus), origin, mode, progress])
  useEffect(() => {
    const m = map.current
    if (!m) return
    const source = ready ? (m.getSource('route') as maplibregl.GeoJSONSource | undefined) : undefined
    source?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path } })
    // Straight lines are dashed: a sketch, not the streets.
    if (source) m.setPaintProperty('route', 'line-dasharray', byStreet ? undefined : [1.5, 1.5])
    markers.current.forEach((k) => k.remove())
    markers.current = []
    if (origin) {
      const me = document.createElement('span')
      me.className = styles.origin ?? ''
      me.setAttribute('aria-label', 'Tu ubicación')
      markers.current.push(new maplibregl.Marker({ element: me }).setLngLat([origin.lng, origin.lat]).addTo(m))
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
      markers.current.push(new maplibregl.Marker({ element: pin }).setLngLat([v.store.lng as number, v.store.lat as number]).setPopup(popup).addTo(m))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `drawn` says what changed
  }, [drawn, ready, failed])

  if (failed) return <RouteSketch stops={stops} origin={origin} />
  const missing = stops.length - located.length
  return (
    <div className={styles.wrap}>
      <div ref={box} className={styles.map} role="region" aria-label="Mapa del recorrido" />
      {missing ? <p className={styles.note}>{missing === 1 ? '1 local no tiene ubicación y no está en el mapa.' : `${missing} locales no tienen ubicación y no están en el mapa.`}</p> : null}
    </div>
  )
}

/** The path by streets when there is one; else the stops joined in straight lines. */
function pathOf(located: Visit[], origin: Point | null, line: [number, number][] | null): [number, number][] {
  if (line && line.length > 1) return line
  const coords = located.map((v) => [v.store.lng as number, v.store.lat as number] as [number, number])
  return origin ? [[origin.lng, origin.lat], ...coords] : coords
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
