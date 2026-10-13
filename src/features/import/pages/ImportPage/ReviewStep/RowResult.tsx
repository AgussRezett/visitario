import type { ReviewRow } from '@/features/import/draft'
import type { Located } from '@/features/import/locate'
import styles from './ReviewStep.module.scss'

/** What the row turns into: the store it matched, or the new one and whether we found it on the map. */
export function RowResult({ row, place }: { row: ReviewRow; place: Located | undefined }) {
  const [text, help] = describe(row, place)
  return (
    <span className={styles.result}>
      <span className={styles.resultText}>{text}</span>
      {help ? <span className={styles.resultHelp}>{help}</span> : null}
    </span>
  )
}

function describe(r: ReviewRow, place: Located | undefined): [string, string?] {
  if (r.status === 'review') return [r.reason ?? 'Para revisar']
  const m = r.match
  if (m) {
    const label = [m.name ?? m.address, m.customerNumber && `cliente ${m.customerNumber}`].filter(Boolean).join(' · ')
    if (m.matchedBy === 'customer') {
      const differs = r.address && r.address.toLowerCase() !== m.address.toLowerCase()
      return [label, differs ? `Mismo número de cliente; en el directorio figura ${m.address}` : 'Reconocido por número de cliente']
    }
    return [label, 'Misma dirección en el directorio']
  }
  const where = r.area || place?.area
  if (place === undefined) return ['Comercio nuevo · ubicando…']
  if (place === null) return ['Comercio nuevo · sin ubicación exacta', 'No encontramos esa altura: se guarda igual y la verificás después']
  return [place.exact ? 'Comercio nuevo · ubicado' : 'Comercio nuevo · ubicación aproximada', `${where ? `${where} · ` : ''}se agrega al directorio`]
}
