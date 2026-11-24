import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import type { Mentionable } from '@/domain/mentions'
import { Button } from '@/ui/Button'
import styles from './ReviewStep.module.scss'

interface UnknownSellersProps {
  list: { name: string; count: number }[]
  /** Who can add sellers; without it, they are chosen store by store. */
  onAddSeller?: (name: string) => Promise<Mentionable>
  onCreated: (name: string, seller: Mentionable) => void
}

/** Sellers the list names that the company does not have yet: created with one tap, for every store that names them. */
export function UnknownSellers({ list, onAddSeller, onCreated }: UnknownSellersProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!list.length) return null
  const create = async (name: string) => {
    if (!onAddSeller) return
    setBusy(name)
    setError(null)
    try {
      onCreated(name, await onAddSeller(name))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos crear el vendedor.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className={styles.unknown} aria-label="Vendedores que no están cargados">
      <p className={styles.unknownTitle}>
        {list.length === 1 ? 'Un vendedor de la lista no está cargado' : `${list.length} vendedores de la lista no están cargados`}
      </p>
      <ul className={styles.unknownList}>
        {list.map((s) => (
          <li key={s.name}>
            <span><b>{s.name}</b> · {s.count === 1 ? '1 local' : `${s.count} locales`}</span>
            {onAddSeller ? (
              <Button variant="secondary" size="sm" loading={busy === s.name} disabled={busy !== null} onClick={() => void create(s.name)}>
                <UserPlus size={16} aria-hidden />Crear vendedor
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {onAddSeller ? null : <p className={styles.unknownHelp}>Elegí uno cargado en cada local, o pedile a un administrador que los cree.</p>}
      {error ? <p className={styles.problem} role="alert">{error}</p> : null}
    </section>
  )
}
