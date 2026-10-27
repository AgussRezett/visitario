import { useCallback, useEffect, useRef, useState } from 'react'
import { readSession, writeSession } from '@/lib/storage'
import { NO_DIRECTORY_FILTERS, readDirectoryFilters, type DirectoryFilters } from '@/domain/directory-filters'

const keyOf = (companyId: string) => `visitario.directory.${companyId}`

/**
 * The directory's filters and page, kept for this tab: going into a store and back (by
 * the "Directorio" link, the menu or the browser) finds them as they were.
 */
export function useDirectoryFilters(companyId: string) {
  const [filters, setFilters] = useState<DirectoryFilters>(() => (companyId ? readDirectoryFilters(readSession(keyOf(companyId))) : NO_DIRECTORY_FILTERS))
  // Another company (or the first time it is known): its own filters.
  const loaded = useRef(companyId)
  useEffect(() => {
    if (loaded.current === companyId) return
    loaded.current = companyId
    setFilters(companyId ? readDirectoryFilters(readSession(keyOf(companyId))) : NO_DIRECTORY_FILTERS)
  }, [companyId])
  useEffect(() => {
    if (companyId && loaded.current === companyId) writeSession(keyOf(companyId), JSON.stringify(filters))
  }, [companyId, filters])

  /** Changing a filter goes back to the first page (unless the page is what changes). */
  const set = useCallback((patch: Partial<DirectoryFilters>) => setFilters((f) => ({ ...f, page: 0, ...patch })), [])
  return [filters, set] as const
}
