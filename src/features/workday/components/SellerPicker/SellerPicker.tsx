import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { BadgeDollarSign, X } from 'lucide-react'
import { matchMentions, type Mentionable } from '@/domain/mentions'
import { Field } from '@/ui/Field'
import { SuggestionList } from '@/features/workday/components/SuggestionList'
import styles from './SellerPicker.module.scss'

interface SellerPickerProps {
  sellers: readonly Mentionable[]
  value: number | null
  onChange: (id: number | null) => void
  /** Admins: a name that is no seller yet can be added from the list. */
  onAddSeller?: (name: string) => Promise<Mentionable>
}

const fold = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** The store's seller: type to search, as with "@" when pasting. */
export function SellerPicker({ sellers, value, onChange, onAddSeller }: SellerPickerProps) {
  const listId = useId()
  const chosen = sellers.find((s) => s.id === value)
  const [text, setText] = useState(chosen?.name ?? '')
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setText(chosen?.name ?? ''), [chosen?.name])

  const query = chosen && text === chosen.name ? '' : text
  const options = matchMentions(sellers, query)
  const name = query.trim()
  const add = onAddSeller && name.length >= 2 && !sellers.some((s) => fold(s.name) === fold(name)) ? name : null
  const count = options.length + (add ? 1 : 0)

  const choose = async (i: number) => {
    const option = options[i]
    setError(null)
    if (option) {
      onChange(option.id)
      setText(option.name)
      return setOpen(false)
    }
    if (!add || !onAddSeller) return
    setAdding(true)
    try {
      const created = await onAddSeller(add)
      onChange(created.id)
      setText(created.name)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos agregar el vendedor.')
    } finally {
      setAdding(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !count) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + count) % count)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void choose(index)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={styles.picker}>
      <Field
        label="Vendedor"
        value={text}
        placeholder={sellers.length ? 'Buscar vendedor' : onAddSeller ? 'Escribí el nombre para agregarlo' : 'Sin vendedores cargados'}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && count ? `${listId}-${index}` : undefined}
        error={error ?? undefined}
        onChange={(e) => {
          setText(e.target.value)
          setIndex(0)
          setOpen(true)
          if (value !== null) onChange(null)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          if (!chosen) setText('')
        }}
        onKeyDown={onKeyDown}
        action={value !== null ? (
          <button type="button" className={styles.clear} onClick={() => { onChange(null); setText('') }} aria-label="Quitar vendedor"><X size={18} aria-hidden /></button>
        ) : undefined}
      />
      {open ? (
        <SuggestionList id={listId} label="Vendedores" heading="Vendedor" icon={<BadgeDollarSign size={16} aria-hidden />} options={options} add={add} adding={adding}
          index={index} empty="Todavía no hay vendedores. Los carga un admin en Catálogos." onHover={setIndex} onChoose={(i) => void choose(i)} />
      ) : null}
    </div>
  )
}
