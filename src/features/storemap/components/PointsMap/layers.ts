import type maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import type { LegendItem, MapPoint } from '@/domain/store-map'

export interface Zone {
  key: string
  label: string
  color: string
  ring: [number, number][]
}

export interface Paint {
  color: (p: MapPoint) => string
  keyOf: (p: MapPoint) => string
  legend: LegendItem[]
}

/** Points closer than this (px) gather in one group, until the map is this close. */
const CLUSTER_RADIUS = 60
const CLUSTER_MAX_ZOOM = 15

export const pointsData = (points: readonly MapPoint[], paint: Paint, selectedId: string | null): FeatureCollection => ({
  type: 'FeatureCollection',
  features: points.map((p) => ({
    type: 'Feature',
    properties: { id: p.id, color: paint.color(p), key: paint.keyOf(p), name: p.name ?? p.address, selected: p.id === selectedId ? 1 : 0 },
    geometry: { type: 'Point', coordinates: [p.lng as number, p.lat as number] },
  })),
})

export const zonesData = (zones: readonly Zone[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: zones.filter((z) => z.ring.length >= 4).map((z) => ({ type: 'Feature', properties: { color: z.color, label: z.label }, geometry: { type: 'Polygon', coordinates: [z.ring] } })),
})

/** What a group counts per legend entry: k_<key> on each cluster. */
export const countKey = (key: string) => `k_${key}`

export function addZones(map: maplibregl.Map) {
  map.addSource('zones', { type: 'geojson', data: zonesData([]) })
  map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 } })
  map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.75 } })
}

/**
 * The points' source, grouping near points and counting them by legend entry (so each
 * group can show its colors). Rebuilt when the legend changes: the counts are fixed when
 * the source is made.
 */
export function setPoints(map: maplibregl.Map, data: FeatureCollection, legend: readonly LegendItem[]) {
  for (const id of ['points', 'points-halo']) if (map.getLayer(id)) map.removeLayer(id)
  if (map.getSource('points')) map.removeSource('points')
  map.addSource('points', {
    type: 'geojson',
    data,
    cluster: true,
    clusterRadius: CLUSTER_RADIUS,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
    clusterProperties: Object.fromEntries(legend.map((l) => [countKey(l.key), ['+', ['case', ['==', ['get', 'key'], l.key], 1, 0]]])),
  })
  const single: maplibregl.FilterSpecification = ['!', ['has', 'point_count']]
  map.addLayer({
    id: 'points-halo', type: 'circle', source: 'points', filter: ['all', single, ['==', ['get', 'selected'], 1]],
    paint: { 'circle-radius': 16, 'circle-color': ['get', 'color'], 'circle-opacity': 0.28 },
  })
  map.addLayer({
    id: 'points', type: 'circle', source: 'points', filter: single,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 8, 17, 11],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 3, 2],
    },
  })
}

export function frame(map: maplibregl.Map, points: readonly MapPoint[]) {
  if (!points.length) return
  const lngs = points.map((p) => p.lng as number)
  const lats = points.map((p) => p.lat as number)
  map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 56, maxZoom: 15, duration: 600 })
}
