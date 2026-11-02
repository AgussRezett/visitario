export interface RowResult {
  idx: number
  created: boolean
  error: string | null
  detail: string | null
}

export interface Failed {
  /** The line as pasted, to fix it and try again. */
  text: string
  reason: string
}

export interface PasteOutcome {
  added: number
  /** Already in this workday: nothing to do. */
  already: number
  /** The same store twice in the list: added once. */
  repeated: number
  failed: Failed[]
}

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

/** Lines that repeat an earlier one (same customer number, or same address without one): line → the first. */
export function repeatedLines(lines: readonly { customerNumber: string; address: string }[]): Map<number, number> {
  const seen = new Map<string, number>()
  const out = new Map<number, number>()
  lines.forEach((l, i) => {
    const key = l.customerNumber ? `#${l.customerNumber}` : norm(l.address)
    if (!key) return
    const first = seen.get(key)
    if (first === undefined) seen.set(key, i)
    else out.set(i, first)
  })
  return out
}

/** Why a line was not added, for the merchandiser to fix it. */
export function reasonFor(error: string, detail: string | null): string {
  switch (error) {
    case 'archived_customer':
      return `Ese nro. de cliente es de un local archivado${detail ? ` (${detail})` : ''}. Sacá el número o pedile a tu supervisor que lo restaure.`
    case 'no_address':
      return 'Ese nro. de cliente no está en el directorio: sumá la dirección en la misma línea.'
    case 'duplicate_customer':
      return 'Ese nro. de cliente ya lo tiene otro local. Revisalo.'
    case 'not_found':
      return 'El vendedor o el canal ya no está activo. Elegí otro con @ o #.'
    default:
      return 'No se pudo agregar. Probá de nuevo.'
  }
}

/** What happened with each pasted line; a line with no result counts as failed. */
export function pasteOutcome(texts: readonly string[], results: readonly RowResult[], repeated: ReadonlyMap<number, number> = new Map()): PasteOutcome {
  const byIdx = new Map(results.map((r) => [r.idx, r]))
  const out: PasteOutcome = { added: 0, already: 0, repeated: 0, failed: [] }
  texts.forEach((text, i) => {
    const r = byIdx.get(i)
    if (!r) out.failed.push({ text, reason: reasonFor('failed', null) })
    else if (r.error) out.failed.push({ text, reason: reasonFor(r.error, r.detail) })
    else if (r.created) out.added++
    else if (repeated.has(i)) out.repeated++
    else out.already++
  })
  return out
}

/** "Agregamos 18 locales · 1 estaba repetido en la lista · 1 ya estaba en la jornada". */
export function outcomeText({ added, already, repeated }: PasteOutcome): string {
  const parts = [added === 1 ? 'Agregamos 1 local' : `Agregamos ${added} locales`]
  if (repeated) parts.push(repeated === 1 ? '1 estaba repetido en la lista' : `${repeated} estaban repetidos en la lista`)
  if (already) parts.push(already === 1 ? '1 ya estaba en la jornada' : `${already} ya estaban en la jornada`)
  return parts.join(' · ')
}
