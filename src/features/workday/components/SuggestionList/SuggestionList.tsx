import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { Mentionable } from '@/domain/mentions'
import styles from './SuggestionList.module.scss'

interface SuggestionListProps {
  id: string
  label: string
  heading: string
  icon: ReactNode
  options: readonly Mentionable[]
  /** "Agregar «Flor» como vendedor", after the options. */
  add: string | null
  adding?: boolean
  /** Shown when there is nothing to choose. */
  empty: string
  index: number
  onHover: (i: number) => void
  onChoose: (i: number) => void
}

/**
 * Options under a field, chosen on mousedown so the field keeps its focus. The field owns the
 * keyboard (arrows, Enter, Escape) and points at the active option with aria-activedescendant.
 */
export function SuggestionList({ id, label, heading, icon, options, add, adding, empty, index, onHover, onChoose }: SuggestionListProps) {
  const pick = (i: number) => ({
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault()
      onChoose(i)
    },
    onMouseEnter: () => onHover(i),
  })
  return (
    <ul id={id} role="listbox" className={styles.list} aria-label={label}>
      <li className={styles.heading} aria-hidden>{heading}</li>
      {options.map((o, i) => (
        <li key={o.id} id={`${id}-${i}`} role="option" aria-selected={i === index}>
          <button type="button" tabIndex={-1} className={styles.option} data-active={i === index || undefined} {...pick(i)}>
            {icon}
            <span className={styles.name}>{o.name}</span>
          </button>
        </li>
      ))}
      {add ? (
        <li id={`${id}-${options.length}`} role="option" aria-selected={index === options.length}>
          <button type="button" tabIndex={-1} className={styles.option} data-active={index === options.length || undefined} disabled={adding} {...pick(options.length)}>
            <Plus size={16} aria-hidden />
            <span className={styles.name}>{adding ? 'Agregando…' : `Agregar «${add}» como vendedor`}</span>
          </button>
        </li>
      ) : null}
      {!options.length && !add ? <li className={styles.hint}>{empty}</li> : null}
    </ul>
  )
}
