import { useCallback, useMemo, useState } from 'react'
import type { DirectoryRow } from '@/features/stores/api/stores'

/**
 * The stores marked in the directory. It keeps each row as it was seen, so the selection
 * survives changing filters or pages, and its current seller, channel and zone are known.
 */
export function useSelection() {
  const [picked, setPicked] = useState<ReadonlyMap<string, DirectoryRow>>(new Map())

  const toggle = useCallback((row: DirectoryRow) => {
    setPicked((m) => {
      const next = new Map(m)
      if (next.has(row.id)) next.delete(row.id)
      else next.set(row.id, row)
      return next
    })
  }, [])

  /** Marks all of these, or unmarks them all when every one is already marked. */
  const toggleAll = useCallback((rows: readonly DirectoryRow[]) => {
    setPicked((m) => {
      const next = new Map(m)
      if (rows.every((r) => next.has(r.id))) rows.forEach((r) => next.delete(r.id))
      else rows.forEach((r) => next.set(r.id, r))
      return next
    })
  }, [])

  /** Marks all of these (the ones already marked stay). */
  const add = useCallback((rows: readonly DirectoryRow[]) => {
    setPicked((m) => new Map([...m, ...rows.map((r) => [r.id, r] as const)]))
  }, [])

  const clear = useCallback(() => setPicked(new Map()), [])
  const rows = useMemo(() => [...picked.values()], [picked])
  return { rows, count: picked.size, has: (id: string) => picked.has(id), toggle, toggleAll, add, clear }
}

export type Selection = ReturnType<typeof useSelection>
