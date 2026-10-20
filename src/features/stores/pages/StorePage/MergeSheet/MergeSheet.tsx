import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useDebounced } from '@/lib/useDebounced'
import { Banner } from '@/ui/Banner'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Sheet } from '@/ui/Sheet'
import { directoryQuery, useStoreAdmin, type DirectoryRow, type StoreDetail } from '@/features/stores/api/stores'
import styles from './MergeSheet.module.scss'

/** Find the duplicate and bring its visits here; the duplicate leaves the directory. */
export function MergeSheet({ store, open, onClose }: { store: StoreDetail; open: boolean; onClose: () => void }) {
  const { merge } = useStoreAdmin(store.id)
  const { confirm, dialog } = useConfirm()
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (open) {
      setQuery(store.address.replace(/\s*\d.*$/, '')) // the street: duplicates usually share it
      merge.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when it opens
  }, [open])
  const q = useDebounced(query.trim(), 300)
  const found = useQuery({ ...directoryQuery(store.companyId, { query: q, filter: 'all', area: null, channel: null, seller: null, page: 0 }), enabled: open && q.length >= 2 })
  const candidates = (found.data?.rows ?? []).filter((r) => r.id !== store.id)
  const here = store.name ?? store.address

  const pick = async (r: DirectoryRow) => {
    const other = r.name ?? r.address
    const ok = await confirm({
      title: `¿Fusionar ${other} en ${here}?`,
      description: `Sus visitas pasan a ${here}, que conserva sus datos y toma los que le falten (número de cliente, zona, ubicación). ${other} sale del directorio.`,
      confirmLabel: 'Fusionar',
    })
    if (!ok) return
    await merge.mutateAsync(r.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Fusionar duplicado" subtitle={`Queda ${here}`}>
      <label className={styles.search}>
        <Search size={18} aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar el duplicado" aria-label="Buscar el duplicado" />
      </label>
      {candidates.length ? (
        <ul className={styles.list}>
          {candidates.map((r) => (
            <li key={r.id}>
              <button type="button" className={styles.item} onClick={() => void pick(r)} disabled={merge.isPending}>
                <span className={styles.name}>{r.name ?? r.address}</span>
                <span className={styles.meta}>{[r.name ? r.address : null, r.customerNumber && `Cliente ${r.customerNumber}`, `${r.visits30d} visitas en 30 días`].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : q.length >= 2 && found.isSuccess ? (
        <p className={styles.help}>No hay otro comercio con esos datos.</p>
      ) : null}
      {merge.error ? <Banner tone="error">{merge.error.message}</Banner> : null}
      {dialog}
    </Sheet>
  )
}
