import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import { ringArcs, ringSize, type LegendItem } from '@/domain/store-map'
import { countKey } from './layers'

const SVG = 'http://www.w3.org/2000/svg'

/** A group as a button: a ring with its points' colors and the count in the middle. */
function groupElement(count: number, slices: { color: string; count: number; label: string }[], className: string) {
  const size = ringSize(count)
  const el = document.createElement('button')
  el.type = 'button'
  el.className = className
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  const said = slices.filter((s) => s.count > 0).map((s) => `${s.count} ${s.label}`).join(', ')
  el.setAttribute('aria-label', `${count} puntos juntos${said ? `: ${said}` : ''}. Tocá para acercar.`)
  el.title = said
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`)
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('aria-hidden', 'true')
  const disc = document.createElementNS(SVG, 'circle')
  disc.setAttribute('cx', String(size / 2))
  disc.setAttribute('cy', String(size / 2))
  disc.setAttribute('r', String(size / 2 - 1))
  disc.setAttribute('fill', '#ffffff')
  svg.append(disc)
  for (const arc of ringArcs(slices, size / 2, Math.max(5, size * 0.17))) {
    const path = document.createElementNS(SVG, 'path')
    path.setAttribute('d', arc.d)
    path.setAttribute('fill', arc.color)
    path.setAttribute('fill-rule', 'evenodd')
    svg.append(path)
  }
  const text = document.createElementNS(SVG, 'text')
  text.setAttribute('x', String(size / 2))
  text.setAttribute('y', String(size / 2))
  text.setAttribute('text-anchor', 'middle')
  text.setAttribute('dominant-baseline', 'central')
  text.textContent = String(count)
  svg.append(text)
  el.append(svg)
  return el
}

/**
 * Keeps one HTML marker per visible group (MapLibre draws the single points itself).
 * Call it on every render; it only touches what changed.
 */
export function syncGroups(map: maplibregl.Map, markers: Map<string, maplibregl.Marker>, legend: readonly LegendItem[], className: string, signature: string) {
  if (!map.getSource('points') || !map.isSourceLoaded('points')) return
  const seen = new Set<string>()
  for (const f of map.querySourceFeatures('points')) {
    const props = f.properties ?? {}
    if (!props.cluster || f.geometry.type !== 'Point') continue
    const id = `${signature}:${props.cluster_id as number}`
    if (seen.has(id)) continue
    seen.add(id)
    if (markers.has(id)) continue
    const count = Number(props.point_count)
    const slices = legend.map((l) => ({ color: l.color, label: l.label, count: Number(props[countKey(l.key)] ?? 0) }))
    const el = groupElement(count, slices, className)
    const at = f.geometry.coordinates as [number, number]
    el.addEventListener('click', () => {
      const source = map.getSource('points') as GeoJSONSource | undefined
      void source?.getClusterExpansionZoom(props.cluster_id as number).then((zoom) => map.easeTo({ center: at, zoom: zoom + 0.3 })).catch(() => null)
    })
    markers.set(id, new maplibregl.Marker({ element: el }).setLngLat(at).addTo(map))
  }
  for (const [id, marker] of markers) {
    if (!seen.has(id)) {
      marker.remove()
      markers.delete(id)
    }
  }
}
