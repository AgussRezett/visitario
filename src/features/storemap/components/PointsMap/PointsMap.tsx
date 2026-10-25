import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MapPoint } from '@/domain/store-map'
import { syncGroups } from './groups'
import { addZones, frame, pointsData, setPoints, zonesData, type Paint, type Zone } from './layers'
import styles from './PointsMap.module.scss'

export type { Zone } from './layers'

// OpenFreeMap: OpenStreetMap streets, free and without a key (attribution shown on the map).
const STYLE = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }
// Buenos Aires, when there is nothing to show yet.
const CENTER: [number, number] = [-58.44, -34.6]

interface PointsMapProps {
  points: MapPoint[]
  paint: Paint
  zones: Zone[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Changes when the filters do: the map frames the points again. */
  frameKey: string
}

/**
 * The points of sale on a street map. Near points gather in a group that shows how many
 * they are and, as a ring, the colors they have; tapping a group comes closer, tapping a
 * point opens it.
 */
export default function PointsMap({ points, paint, zones, selectedId, onSelect, frameKey }: PointsMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const groups = useRef(new Map<string, maplibregl.Marker>())
  const legendKeys = useRef('')
  const version = useRef(0)
  const latest = useRef({ paint, onSelect })
  latest.current = { paint, onSelect }
  const [ready, setReady] = useState(false)
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
      addZones(m)
      m.on('click', 'points', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (typeof id === 'string') latest.current.onSelect(id)
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
      // Groups are HTML (a ring of colors with the count): kept in step as the map moves.
      m.on('render', () => syncGroups(m, groups.current, latest.current.paint.legend, styles.group ?? '', String(version.current)))
      setReady(true)
    })
    map.current = m
    const markers = groups.current
    return () => {
      hover.remove()
      markers.forEach((g) => g.remove())
      markers.clear()
      m.remove()
      map.current = null
      legendKeys.current = ''
      setReady(false)
    }
  }, [failed])

  // Data or colors change: repaint without redrawing the map.
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const data = pointsData(points, paint, selectedId)
    const keys = paint.legend.map((l) => l.key).join('|')
    version.current++
    if (keys !== legendKeys.current) {
      legendKeys.current = keys
      setPoints(m, data, paint.legend)
    } else {
      ;(m.getSource('points') as GeoJSONSource | undefined)?.setData(data)
    }
    ;(m.getSource('zones') as GeoJSONSource | undefined)?.setData(zonesData(zones))
    m.triggerRepaint()
  }, [ready, points, paint, zones, selectedId])

  // New filters: frame what is left.
  useEffect(() => {
    if (map.current && ready) frame(map.current, points)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the filters change
  }, [ready, frameKey])

  if (failed) return <p className={styles.note}>No pudimos mostrar el mapa en este dispositivo. Los números de abajo siguen valiendo.</p>
  return <div ref={box} className={styles.map} role="region" aria-label={`Mapa con ${points.length} ${points.length === 1 ? 'punto de venta' : 'puntos de venta'}`} />
}
