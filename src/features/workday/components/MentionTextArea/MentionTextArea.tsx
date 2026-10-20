import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { BadgeDollarSign, Store } from 'lucide-react'
import { activeMention, insertMention, matchMentions, type Mentionable, type MentionTrigger } from '@/domain/mentions'
import { TextArea } from '@/ui/TextArea'
import { SuggestionList } from '@/features/workday/components/SuggestionList'
import styles from './MentionTextArea.module.scss'

interface MentionTextAreaProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** Offered after "@". */
  sellers: readonly Mentionable[]
  /** Offered after "#". */
  channels: readonly Mentionable[]
  /** Admins: a name that is no seller yet can be added from the list. */
  onAddSeller?: (name: string) => Promise<Mentionable>
  rows?: number
  placeholder?: string
  help?: ReactNode
}

type Open = { trigger: MentionTrigger; start: number; caret: number; query: string; options: Mentionable[]; add: string | null }

const fold = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** A text area where "@" offers the sellers and "#" the channels, as mentions in WhatsApp. */
export function MentionTextArea({ label, value, onChange, sellers, channels, onAddSeller, rows, placeholder, help }: MentionTextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const listId = useId()
  const [open, setOpen] = useState<Open | null>(null)
  const [index, setIndex] = useState(0)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Looks at what is right before the caret and opens, updates or closes the list. */
  const look = (text: string, caret: number) => {
    const m = activeMention(text, caret)
    if (!m) return setOpen(null)
    const list = m.trigger === '@' ? sellers : channels
    const options = matchMentions(list, m.query)
    const name = m.query.trim()
    const add = m.trigger === '@' && onAddSeller && name.length >= 2 && !list.some((s) => fold(s.name) === fold(name)) ? name : null
    // An empty catalog still opens: it says where to load them.
    if (!options.length && !add && list.length) return setOpen(null)
    setOpen({ trigger: m.trigger, start: m.start, caret, query: m.query, options, add })
    setIndex((i) => Math.min(i, Math.max(0, options.length + (add ? 1 : 0) - 1)))
  }

  const place = (o: Open, name: string) => {
    const next = insertMention(value, o.start, o.caret, o.trigger, name)
    onChange(next.text)
    setOpen(null)
    setIndex(0)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      el.setSelectionRange(next.caret, next.caret)
    })
  }

  const choose = async (i: number) => {
    if (!open) return
    const option = open.options[i]
    if (option) return place(open, option.name)
    if (!open.add || !onAddSeller) return
    setAdding(true)
    setError(null)
    try {
      place(open, (await onAddSeller(open.add)).name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos agregar el vendedor.')
    } finally {
      setAdding(false)
    }
  }

  const count = open ? open.options.length + (open.add ? 1 : 0) : 0
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || !count) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + count) % count)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      void choose(index)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(null)
    }
  }

  const Icon = open?.trigger === '#' ? Store : BadgeDollarSign
  const kind = open?.trigger === '@' ? 'vendedores' : 'canales'
  return (
    <div className={styles.field}>
      <TextArea
        ref={ref}
        label={label}
        value={value}
        rows={rows}
        placeholder={placeholder}
        help={help}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={Boolean(open)}
        aria-controls={listId}
        aria-activedescendant={open && count ? `${listId}-${index}` : undefined}
        onChange={(e) => {
          onChange(e.target.value)
          look(e.target.value, e.target.selectionStart)
        }}
        onSelect={(e) => look(e.currentTarget.value, e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(null)}
      />
      {open ? (
        <SuggestionList id={listId} label={open.trigger === '@' ? 'Vendedores' : 'Canales'} heading={open.trigger === '@' ? 'Vendedor' : 'Canal'}
          icon={<Icon size={16} aria-hidden />} options={open.options} add={open.add} adding={adding} index={index}
          empty={`Todavía no hay ${kind}. Los carga un admin en Catálogos.`} onHover={setIndex} onChoose={(i) => void choose(i)} />
      ) : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  )
}
