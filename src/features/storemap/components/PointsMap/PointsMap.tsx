import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection } from 'geojson'
import type { MapPoint } from '@/domain/store-map'
import styles from './PointsMap.module.scss'

// OpenFreeMap: OpenStreetMap streets, free and without a key (attribution shown on the map).
const STYLE = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }
// Buenos Aires, when there is nothing to show yet.
const CENTER: [number, number] = [-58.44, -34.6]

export interface Zone {
  key: string
  label: string
  color: string
  ring: [number, number][]
}

interface PointsMapProps {
  points: MapPoint[]
  colorOf: (p: MapPoint) => string
  zones: Zone[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Changes when the filters do: the map frames the points again. */
  frameKey: string
}

type FC = FeatureCollection

const pointsData = (points: MapPoint[], colorOf: (p: MapPoint) => string, selectedId: string | null): FC => ({
  type: 'FeatureCollection',
  features: points.map((p) => ({
    type: 'Feature',
    properties: { id: p.id, color: colorOf(p), name: p.name ?? p.address, selected: p.id === selectedId ? 1 : 0 },
    geometry: { type: 'Point', coordinates: [p.lng as number, p.lat as number] },
  })),
})

const zonesData = (zones: Zone[]): FC => ({
  type: 'FeatureCollection',
  features: zones.filter((z) => z.ring.length >= 4).map((z) => ({ type: 'Feature', properties: { color: z.color, label: z.label }, geometry: { type: 'Polygon', coordinates: [z.ring] } })),
})

function frame(map: maplibregl.Map, points: MapPoint[]) {
  if (!points.length) return
  const lngs = points.map((p) => p.lng as number)
  const lats = points.map((p) => p.lat as number)
  map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 56, maxZoom: 15, duration: 600 })
}

/** The points of sale as balloons on a street map; tap one to see it. */
export default function PointsMap({ points, colorOf, zones, selectedId, onSelect, frameKey }: PointsMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const select = useRef(onSelect)
  select.current = onSelect

  useEffect(() => {
    const el = box.current
    if (!el || failed) return
    const dark = document.documentElement.dataset.theme === 'dark'
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({
        container: el,
        style: dark ? STYLE.dark : STYLE.light,
        center: CENTER,
        zoom: 11,
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
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('error', () => {
      if (!m.isStyleLoaded()) setFailed(true)
    })
    const hover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: styles.tip })
    m.on('load', () => {
      m.addSource('zones', { type: 'geojson', data: zonesData([]) })
      m.addSource('points', { type: 'geojson', data: pointsData([], () => '', null) })
      m.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 } })
      m.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.75 } })
      m.addLayer({
        id: 'points-halo', type: 'circle', source: 'points', filter: ['==', ['get', 'selected'], 1],
        paint: { 'circle-radius': 16, 'circle-color': ['get', 'color'], 'circle-opacity': 0.28 },
      })
      m.addLayer({
        id: 'points', type: 'circle', source: 'points',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 8, 17, 11],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 3, 2],
        },
      })
      m.on('click', 'points', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (typeof id === 'string') select.current(id)
      })
      m.on('mouseenter', 'points', (e) => {
        m.getCanvas().style.cursor = 'pointer'
        const f = e.features?.[0]
        if (f && f.geometry.type === 'Point') hover.setLngLat(f.geometry.coordinates as [number, number]).setText(String(f.properties?.name ?? '')).addTo(m)
      })
      m.on('mouseleave', 'points', () => {
        m.getCanvas().style.cursor = ''
        hover.remove()
      })
      setReady(true)
    })
    map.current = m
    return () => {
      hover.remove()
      m.remove()
      map.current = null
      setReady(false)
    }
  }, [failed])

  // Data changes repaint without redrawing the map.
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    ;(m.getSource('points') as GeoJSONSource | undefined)?.setData(pointsData(points, colorOf, selectedId))
    ;(m.getSource('zones') as GeoJSONSource | undefined)?.setData(zonesData(zones))
  }, [ready, points, colorOf, zones, selectedId])

  // New filters: frame what is left.
  useEffect(() => {
    if (map.current && ready) frame(map.current, points)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the filters change
  }, [ready, frameKey])

  if (failed) return <p className={styles.note}>No pudimos mostrar el mapa en este dispositivo. Los números de abajo siguen valiendo.</p>
  return <div ref={box} className={styles.map} role="region" aria-label={`Mapa con ${points.length} ${points.length === 1 ? 'punto de venta' : 'puntos de venta'}`} />
}
