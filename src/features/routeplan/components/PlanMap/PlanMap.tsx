import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { inZone } from '@/domain/route-plan'
import styles from './PlanMap.module.scss'

// OpenFreeMap: OpenStreetMap streets, free and without a key (attribution shown on the map).
const STYLE = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }
const CENTER: [number, number] = [-58.44, -34.6]

type LngLat = [number, number]
interface Spot { id: string; lat: number; lng: number }

interface PlanMapProps {
  /** The stores the filters leave, as small dots. */
  candidates: Spot[]
  /** The route, in order: numbered pins. */
  stops: (Spot & { label: string })[]
  /** The path by streets; without it, straight dashed lines. */
  line: LngLat[] | null
  /** The zone chosen, or being drawn. */
  zone: LngLat[] | null
  /** Taps add the zone's corners. */
  drawing: boolean
  onDrawPoint: (p: LngLat) => void
  /** Changes when there is something new to frame. */
  frameKey: string
}

const empty = { type: 'FeatureCollection' as const, features: [] }

/** Plans on a street map: the zone, the stores that may go, and the route chosen. */
export default function PlanMap({ candidates, stops, line, zone, drawing, onDrawPoint, frameKey }: PlanMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const pins = useRef<maplibregl.Marker[]>([])
  const latest = useRef({ drawing, onDrawPoint })
  latest.current = { drawing, onDrawPoint }
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el || failed) return
    const dark = document.documentElement.dataset.theme === 'dark'
    const css = getComputedStyle(document.documentElement)
    const accent = css.getPropertyValue(dark ? '--lime' : '--forest').trim() || '#173b30'
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({
        container: el,
        style: dark ? STYLE.dark : STYLE.light,
        center: CENTER,
        zoom: 11,
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
    m.on('load', () => {
      for (const id of ['zone', 'corners', 'cands', 'route']) m.addSource(id, { type: 'geojson', data: empty })
      m.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': accent, 'fill-opacity': 0.08 } })
      m.addLayer({ id: 'zone-line', type: 'line', source: 'zone', paint: { 'line-color': accent, 'line-width': 2, 'line-dasharray': [2, 1.5] } })
      m.addLayer({ id: 'corners', type: 'circle', source: 'corners', paint: { 'circle-radius': 6, 'circle-color': accent, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } })
      // Stores inside the zone stand out: bigger, in the accent; the rest stay grey.
      m.addLayer({ id: 'cands', type: 'circle', source: 'cands', paint: {
        'circle-radius': ['case', ['get', 'inside'], 6, 4],
        'circle-color': ['case', ['get', 'inside'], accent, '#8a8a85'],
        'circle-opacity': ['case', ['get', 'inside'], 1, 0.7],
        'circle-stroke-color': '#fff', 'circle-stroke-width': ['case', ['get', 'inside'], 2, 1],
      } })
      m.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': accent, 'line-width': 4, 'line-opacity': 0.9 } })
      m.on('click', (e) => {
        if (latest.current.drawing) latest.current.onDrawPoint([e.lngLat.lng, e.lngLat.lat])
      })
      setReady(true)
    })
    map.current = m
    return () => {
      pins.current.forEach((p) => p.remove())
      pins.current = []
      map.current = null
      setReady(false)
      m.remove()
    }
  }, [failed])

  // The zone, the dots, the route and its pins, drawn again when any of them changes.
  const drawn = JSON.stringify([zone, candidates.length, candidates[0]?.id, stops.map((s) => s.id), line?.length])
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const ring = zone ?? []
    ;(m.getSource('zone') as GeoJSONSource).setData(
      ring.length >= 3
        ? { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0] as LngLat]] } }
        : { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } },
    )
    ;(m.getSource('corners') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: drawing ? ring.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } })) : [],
    })
    const chosen = new Set(stops.map((s) => s.id))
    ;(m.getSource('cands') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: candidates.filter((c) => !chosen.has(c.id)).map((c) => ({
        type: 'Feature', properties: { inside: ring.length >= 3 && inZone(c.lng, c.lat, ring) }, geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      })),
    })
    const path = line && line.length > 1 ? line : stops.map((s) => [s.lng, s.lat] as LngLat)
    ;(m.getSource('route') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path } })
    m.setPaintProperty('route', 'line-dasharray', line && line.length > 1 ? undefined : [1.5, 1.5])
    pins.current.forEach((p) => p.remove())
    pins.current = stops.map((s, i) => {
      const pin = document.createElement('span')
      pin.className = `${styles.pin ?? ''} ${i === 0 ? (styles.first ?? '') : ''}`.trim()
      pin.textContent = String(i + 1)
      pin.setAttribute('aria-label', `${i + 1}. ${s.label}`)
      pin.title = s.label
      return new maplibregl.Marker({ element: pin }).setLngLat([s.lng, s.lat]).addTo(m)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `drawn` says what changed
  }, [drawn, ready, drawing])

  // Frame the route, else the zone, else the stores that may go.
  useEffect(() => {
    const m = map.current
    if (!m || !ready || drawing) return
    const pts: LngLat[] = stops.length ? stops.map((s) => [s.lng, s.lat]) : zone && zone.length >= 3 ? zone : candidates.map((c) => [c.lng, c.lat])
    if (!pts.length) return
    const lngs = pts.map((p) => p[0])
    const lats = pts.map((p) => p[1])
    m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, maxZoom: 16, duration: 400 })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when there is something new to frame
  }, [ready, frameKey])

  if (failed) return <p className={styles.note}>No pudimos mostrar el mapa en este dispositivo. La lista del recorrido sigue valiendo.</p>
  return <div ref={box} className={styles.map} data-drawing={drawing || undefined} role="region" aria-label={drawing ? 'Mapa: tocá para marcar las esquinas de la zona' : 'Mapa del recorrido'} />
}
