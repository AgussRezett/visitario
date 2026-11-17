import { Banner } from '@/ui/Banner'
import { outcomeText, type PasteOutcome } from '../paste-results'
import styles from './PasteNotes.module.scss'

interface PasteNotesProps {
  outcome: PasteOutcome | null
  /** @ and # names nobody has. */
  unknown: string[]
  /** Lines that repeat an earlier one. */
  twice: string[]
  /** Stores already in someone's day. */
  repeated: string[]
}

/** What to fix or know about the pasted lines before adding them. */
export function PasteNotes({ outcome, unknown, twice, repeated }: PasteNotesProps) {
  return (
    <>
      {outcome ? (
        <Banner tone="warn" title={`${outcomeText(outcome)}. ${outcome.failed.length === 1 ? 'Falta 1' : `Faltan ${outcome.failed.length}`}:`}>
          <p>Te dejamos {outcome.failed.length === 1 ? 'esa línea' : 'esas líneas'} arriba: corregilas y tocá Agregar de nuevo.</p>
          <ul className={styles.repeated}>{outcome.failed.map((f, i) => <li key={i}><b>{f.text}</b> — {f.reason}</li>)}</ul>
        </Banner>
      ) : null}
      {unknown.length ? <Banner tone="warn">No encontramos {unknown.join(', ')}. Elegilos de la lista que aparece al escribir @ o #; si no están, se cargan en Catálogos.</Banner> : null}
      {twice.length ? (
        <Banner tone="info" title={twice.length === 1 ? 'Hay una línea repetida: se agrega una vez' : `Hay ${twice.length} líneas repetidas: se agregan una vez`}>
          <ul className={styles.repeated}>{twice.map((r) => <li key={r}>{r}</li>)}</ul>
        </Banner>
      ) : null}
      {repeated.length ? (
        <Banner tone="warn" title={repeated.length === 1 ? 'Una dirección ya está en otra jornada' : `${repeated.length} direcciones ya están en otras jornadas`}>
          <ul className={styles.repeated}>{repeated.map((r) => <li key={r}>{r}</li>)}</ul>
        </Banner>
      ) : null}
    </>
  )
}
