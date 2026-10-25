import { PencilLine, X } from 'lucide-react'
import { Button } from '@/ui/Button'
import styles from './SelectionBar.module.scss'

interface Props {
  count: number
  /** Marked, but not in the rows on screen (other filters or pages). */
  hidden: number
  onEdit: () => void
  onClear: () => void
}

/** What is marked in the directory, and what to do with it. Stays at the bottom while scrolling. */
export function SelectionBar({ count, hidden, onEdit, onClear }: Props) {
  if (!count) return null
  return (
    <section className={styles.bar} aria-label="Comercios seleccionados">
      <p className={styles.text} aria-live="polite">
        <strong>{count === 1 ? '1 seleccionado' : `${count} seleccionados`}</strong>
        {hidden ? <span className={styles.hidden}>{hidden === 1 ? '1 no se ve en esta vista' : `${hidden} no se ven en esta vista`}</span> : null}
      </p>
      <div className={styles.actions}>
        <Button variant="ghost" size="md" onClick={onClear}><X size={18} aria-hidden />Quitar selección</Button>
        <Button size="md" onClick={onEdit}><PencilLine size={18} aria-hidden />Editar en lote</Button>
      </div>
    </section>
  )
}
