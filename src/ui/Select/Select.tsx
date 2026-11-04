import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import clsx from 'clsx'
import { useIsDesktop } from '@/lib/useMedia'
import { edge, filterOptions, placeBelowOrAbove, step, typeahead, type Placement, type SelectOption } from './listbox'
import styles from './Select.module.scss'

export type { SelectOption } from './listbox'

export interface SelectProps {
  label: string
  value: string | number | null | undefined
  options: SelectOption[]
  onChange: (value: string) => void
  /** The label stays for screen readers only (filters that say it in their value). */
  hideLabel?: boolean
  placeholder?: string
  disabled?: boolean
  /** On the button. */
  className?: string
  /** Before the value: an icon, and a word like "Ordenar:". */
  icon?: ReactNode
  prefix?: string
  /** `sm` (40 px) for filter bars; `md` (48 px) like the other inputs. */
  size?: 'sm' | 'md'
  /** A search box over the list; on by default for long lists. */
  searchable?: boolean
  id?: string
  /** data-* attributes go on the button (for styles that depend on the value). */
  [data: `data-${string}`]: string | undefined
}

/**
 * Visitario's dropdown: a button that opens the list under it on desktop, or as a bottom
 * sheet on phones. Keyboard like a native select (arrows, Home/End, Enter, Escape, typing
 * a letter); long lists get a search box. Shown in the top layer, so it works inside sheets.
 */
export function Select({ value, onChange, ...props }: SelectProps) {
  return <ListboxField {...props} chosen={[String(value ?? '')]} onPick={(v) => v !== String(value ?? '') && onChange(v)} />
}

type FieldProps = Omit<SelectProps, 'value' | 'onChange'> & {
  /** The values chosen: one for a Select, any for a MultiSelect. */
  chosen: string[]
  onPick: (value: string) => void
  /** Several at once: picking toggles and the list stays open. */
  multiple?: boolean
  /** What the button says (a MultiSelect counts what is chosen). */
  text?: ReactNode
  /** A first row that clears every choice ("Todas las zonas"). */
  allLabel?: string
  onClear?: () => void
}

/** The button, the list and its keyboard; shared by Select and MultiSelect. */
export function ListboxField({ label, chosen, onPick, multiple, text, allLabel, onClear, options: own, hideLabel, placeholder = 'Elegí una opción', disabled, className, icon, prefix, size = 'md', searchable, id, ...data }: FieldProps) {
  const ALL = '\u0000all'
  const options: SelectOption[] = allLabel ? [{ value: ALL, label: allLabel }, ...own] : own
  const desktop = useIsDesktop()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [place, setPlace] = useState<Placement | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const auto = useId()
  const triggerId = id ?? `${auto}-trigger`
  const labelId = `${auto}-label`
  const listId = `${auto}-list`
  const optionId = (i: number) => `${auto}-option-${i}`

  const isChosen = (o: SelectOption) => (o.value === ALL ? chosen.length === 0 : chosen.includes(String(o.value)))
  const selected = options.find(isChosen)
  const canSearch = searchable ?? options.length > 8
  const shown = canSearch ? filterOptions(options, query) : options

  const openList = () => {
    if (disabled) return
    const i = options.findIndex((o) => o === selected)
    setQuery('')
    setActive(i >= 0 ? i : edge(options, 'first'))
    setOpen(true)
  }
  const close = (focusTrigger = true) => {
    setOpen(false)
    if (focusTrigger) trigger.current?.focus({ preventScroll: true })
  }
  const choose = (o: SelectOption | undefined) => {
    if (!o || o.disabled) return
    if (o.value === ALL) onClear?.()
    else onPick(String(o.value))
    if (!multiple) close()
  }

  // Into the top layer (above an open sheet), placed under the trigger on desktop.
  useLayoutEffect(() => {
    if (!open) return
    const el = layer.current
    if (el && typeof el.showPopover === 'function' && !el.matches(':popover-open')) el.showPopover()
    const placeIt = () => {
      const r = trigger.current?.getBoundingClientRect()
      if (r) setPlace(placeBelowOrAbove(r, { width: window.innerWidth, height: window.innerHeight }, list.current?.scrollHeight ?? 320))
    }
    placeIt()
    ;(canSearch ? search.current : list.current)?.focus({ preventScroll: true })
    window.addEventListener('resize', placeIt)
    window.addEventListener('scroll', placeIt, true)
    return () => {
      window.removeEventListener('resize', placeIt)
      window.removeEventListener('scroll', placeIt, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placed once per opening
  }, [open])

  useEffect(() => {
    if (open && active >= 0) document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids are stable
  }, [open, active])

  const onTriggerKey = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault()
      openList()
    }
  }

  const onListKey = (e: KeyboardEvent, inSearch: boolean) => {
    const move = (i: number) => {
      e.preventDefault()
      setActive(i)
    }
    if (e.key === 'ArrowDown') return move(step(shown, active, 1))
    if (e.key === 'ArrowUp') return move(step(shown, active, -1))
    if (!inSearch && e.key === 'Home') return move(edge(shown, 'first'))
    if (!inSearch && e.key === 'End') return move(edge(shown, 'last'))
    if (e.key === 'Enter' || (!inSearch && e.key === ' ')) {
      e.preventDefault()
      return choose(shown[active])
    }
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      return close()
    }
    if (!inSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : '') + e.key, at: now }
      move(typeahead(shown, active, typed.current.text))
    }
  }

  const items: ReactNode[] = []
  shown.forEach((o, i) => {
    if (o.group && o.group !== shown[i - 1]?.group) {
      items.push(<li key={`g-${o.group}`} role="presentation" className={styles.group}>{o.group}</li>)
    }
    const isSelected = isChosen(o)
    items.push(
      <li
        key={String(o.value)}
        id={optionId(i)}
        role="option"
        aria-selected={isSelected}
        aria-disabled={o.disabled || undefined}
        data-active={i === active || undefined}
        className={styles.option}
        onPointerMove={() => i !== active && !o.disabled && setActive(i)}
        onClick={() => choose(o)}
      >
        {multiple ? <span className={styles.box} data-on={isSelected || undefined} aria-hidden>{isSelected ? <Check size={14} strokeWidth={3} /> : null}</span> : null}
        {o.leading ? <span className={styles.leading} aria-hidden>{o.leading}</span> : null}
        <span className={styles.optionText}>
          <span className={styles.optionLabel}>{o.label}</span>
          {o.hint ? <span className={styles.hint}>{o.hint}</span> : null}
        </span>
        {isSelected && !multiple ? <Check size={18} strokeWidth={2.5} aria-hidden className={styles.check} /> : null}
      </li>,
    )
  })

  return (
    <div className={styles.field}>
      <label id={labelId} htmlFor={triggerId} className={clsx(styles.label, hideLabel && styles.srOnly)}>{label}</label>
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelId}
        {...data}
        data-value={chosen.join(',')}
        disabled={disabled}
        className={clsx(styles.trigger, styles[size], open && styles.open, className)}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
      >
        {icon ? <span className={styles.icon} aria-hidden>{icon}</span> : null}
        {!text && selected?.leading ? <span className={styles.leading} aria-hidden>{selected.leading}</span> : null}
        <span className={styles.value}>
          {prefix ? <span className={styles.prefix}>{prefix} </span> : null}
          {text ?? (selected ? selected.selectedLabel ?? selected.label : <span className={styles.placeholder}>{placeholder}</span>)}
        </span>
        <ChevronDown size={18} aria-hidden className={styles.chevron} />
      </button>

      {open ? (
        <div ref={layer} popover="auto" className={styles.layer} data-sheet={!desktop || undefined}
          onToggle={(e) => (e as unknown as { newState?: string }).newState === 'closed' && setOpen(false)}>
          <div className={styles.backdrop} onClick={() => close()} aria-hidden />
          <div className={styles.panel} style={desktop && place ? { left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight } : undefined}>
            {desktop ? null : (
              <div className={styles.sheetHead}>
                <span className={styles.sheetTitle}>{label}</span>
                <button type="button" className={styles.closeButton} onClick={() => close()} aria-label="Cerrar"><X size={20} aria-hidden /></button>
              </div>
            )}
            {canSearch ? (
              <div className={styles.search}>
                <Search size={16} aria-hidden />
                <input
                  ref={search}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(edge(filterOptions(options, e.target.value), 'first'))
                  }}
                  onKeyDown={(e) => onListKey(e, true)}
                  placeholder="Buscar"
                  aria-label={`Buscar en ${label}`}
                  aria-controls={listId}
                  aria-activedescendant={active >= 0 ? optionId(active) : undefined}
                  autoComplete="off"
                />
              </div>
            ) : null}
            <ul ref={list} id={listId} role="listbox" aria-labelledby={labelId} aria-multiselectable={multiple || undefined} tabIndex={-1} className={styles.list}
              aria-activedescendant={!canSearch && active >= 0 ? optionId(active) : undefined}
              onKeyDown={(e) => onListKey(e, false)}>
              {items}
            </ul>
            {shown.length ? null : <p className={styles.empty}>Nada coincide con “{query}”.</p>}
            {multiple ? (
              <div className={styles.done}>
                <span className={styles.count}>{chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'elegido' : 'elegidos'}` : allLabel ?? 'Ninguno'}</span>
                <button type="button" className={styles.doneButton} onClick={() => close()}>Listo</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
