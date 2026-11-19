import { Check, PenLine, Undo2, X } from 'lucide-react'
import { Button } from '@/ui/Button'
import styles from './ZoneControls.module.scss'

interface ZoneControlsProps {
  /** The zone's corners; null when the route may take stores anywhere. */
  zone: [number, number][] | null
  /** Tapping the map adds corners. */
  drawing: boolean
  /** How many stores the filters take inside the zone (once it has 3 corners). */
  inside: number | null
  onDraw: () => void
  onUndo: () => void
  onDone: () => void
  onClear: () => void
}

/** Optionally mark on the map where the route goes: it applies as soon as it has 3 corners, no name, nothing to save. */
export function ZoneControls({ zone, drawing, inside, onDraw, onUndo, onDone, onClear }: ZoneControlsProps) {
  const corners = zone?.length ?? 0
  const ready = corners >= 3
  const count = inside === null ? '' : `, con ${inside} ${inside === 1 ? 'local' : 'locales'} adentro`

  if (drawing) {
    return (
      <div className={styles.drawing}>
        <p className={styles.help} role="status">
          {ready ? `Zona de ${corners} esquinas${count}. Seguí tocando para ajustarla, o armá el recorrido.` : `Tocá el mapa para marcar las esquinas de la zona (${corners} de al menos 3).`}
        </p>
        <div className={styles.row}>
          <Button variant="secondary" size="md" onClick={onUndo} disabled={!corners}><Undo2 size={18} aria-hidden />Deshacer</Button>
          <Button variant="secondary" size="md" onClick={onDone} disabled={!ready}><Check size={18} aria-hidden />Listo</Button>
          <Button variant="ghost" size="md" onClick={onClear}>Cancelar</Button>
        </div>
      </div>
    )
  }

  if (ready) {
    return (
      <div className={styles.row}>
        <p className={styles.summary} role="status">Zona marcada: {corners} esquinas{count}.</p>
        <Button variant="secondary" size="md" onClick={onDraw}><PenLine size={18} aria-hidden />Marcar otra</Button>
        <Button variant="ghost" size="md" onClick={onClear}><X size={18} aria-hidden />Quitar zona</Button>
      </div>
    )
  }

  return (
    <div className={styles.row}>
      <p className={styles.summary}>Sin zona: toma locales de todo el mapa.</p>
      <Button variant="secondary" size="md" onClick={onDraw}><PenLine size={18} aria-hidden />Marcar zona</Button>
    </div>
  )
}
