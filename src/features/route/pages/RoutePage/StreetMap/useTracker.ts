import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import styles from './StreetMap.module.scss'

/** Someone followed live on the map: a supervisor watching an activador. */
export interface Tracked {
  name: string
  lat: number
  lng: number
  /** The path walked so far, as [lng, lat], oldest first. */
  trail: [number, number][]
  /** No news for a while: shown greyed. */
  stale: boolean
  /** "hace 2 min", for the label. */
  seen: string
}

const FOLLOW_ZOOM = 16

/**
 * Draws the person and their path, and follows them as they move, like a maps app: until
 * whoever watches drags the map; `center` starts following again.
 */
export function useTracker(map: maplibregl.Map | null, tracker: Tracked | null) {
  const marker = useRef<maplibregl.Marker | null>(null)
  const [following, setFollowing] = useState(true)

  // The path's line, once per map.
  useEffect(() => {
    if (!map || map.getSource('trail')) return
    // The path in the "in progress" blue, as the stop being worked on.
    const color = getComputedStyle(document.documentElement).getPropertyValue('--active').trim() || '#2f5bd3'
    map.addSource('trail', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } })
    map.addLayer({ id: 'trail', type: 'line', source: 'trail', layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.55 } })
  }, [map])

  // Moving the map by hand stops following (zooming does not).
  useEffect(() => {
    if (!map) return
    const stop = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) setFollowing(false)
    }
    map.on('dragstart', stop)
    return () => {
      map.off('dragstart', stop)
    }
  }, [map])

  const where = tracker ? `${tracker.lng},${tracker.lat}` : ''
  useEffect(() => {
    if (!map) return
    if (!tracker) {
      marker.current?.remove()
      marker.current = null
      return
    }
    const source = map.getSource('trail') as maplibregl.GeoJSONSource | undefined
    source?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [...tracker.trail, [tracker.lng, tracker.lat]] } })
    if (!marker.current) {
      const dot = document.createElement('span')
      dot.setAttribute('role', 'img')
      marker.current = new maplibregl.Marker({ element: dot }).setLngLat([tracker.lng, tracker.lat]).addTo(map)
    }
    const dot = marker.current.getElement()
    dot.className = `${styles.tracker ?? ''} ${tracker.stale ? styles.trackerStale ?? '' : ''}`.trim()
    dot.textContent = tracker.name.slice(0, 1).toUpperCase()
    dot.setAttribute('aria-label', `${tracker.name}, ${tracker.seen}`)
    marker.current.setLngLat([tracker.lng, tracker.lat])
    if (following) map.easeTo({ center: [tracker.lng, tracker.lat], zoom: Math.max(map.getZoom(), FOLLOW_ZOOM), duration: 800 })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `where` and the trail length say what moved
  }, [map, where, tracker?.trail.length, tracker?.stale, tracker?.seen, following])

  useEffect(() => () => {
    marker.current?.remove()
    marker.current = null
  }, [map])

  const center = useCallback(() => setFollowing(true), [])
  return { following, center }
}
