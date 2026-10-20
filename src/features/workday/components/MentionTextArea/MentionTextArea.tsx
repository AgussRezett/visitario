import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { BadgeDollarSign, Store } from 'lucide-react'
import { activeMention, insertMention, matchMentions, type Mentionable, type MentionTrigger } from '@/domain/mentions'
import { TextArea } from '@/ui/TextArea'
import styles from './MentionTextArea.module.scss'

interface MentionTextAreaProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** Offered after "@". */
  sellers: readonly Mentionable[]
  /** Offered after "#". */
  channels: readonly Mentionable[]
  rows?: number
  placeholder?: string
  help?: ReactNode
}

type Open = { trigger: MentionTrigger; start: number; caret: number; options: Mentionable[] }

/** A text area where "@" offers the sellers and "#" the channels, as mentions in WhatsApp. */
export function MentionTextArea({ label, value, onChange, sellers, channels, rows, placeholder, help }: MentionTextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const listId = useId()
  const [open, setOpen] = useState<Open | null>(null)
  const [index, setIndex] = useState(0)

  /** Looks at what is right before the caret and opens, updates or closes the list. */
  const look = (text: string, caret: number) => {
    const m = activeMention(text, caret)
    const list = m?.trigger === '@' ? sellers : m?.trigger === '#' ? channels : []
    const options = m ? matchMentions(list, m.query) : []
    if (!m || !options.length) return setOpen(null)
    setOpen({ trigger: m.trigger, start: m.start, caret, options })
    setIndex((i) => Math.min(i, options.length - 1))
  }

  const choose = (option: Mentionable) => {
    if (!open) return
    const next = insertMention(value, open.start, open.caret, open.trigger, option.name)
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

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setIndex((i) => (i + step + open.options.length) % open.options.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const option = open.options[index]
      if (!option) return
      e.preventDefault()
      choose(option)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(null)
    }
  }

  const Icon = open?.trigger === '#' ? Store : BadgeDollarSign
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
        aria-activedescendant={open ? `${listId}-${index}` : undefined}
        onChange={(e) => {
          onChange(e.target.value)
          look(e.target.value, e.target.selectionStart)
        }}
        onSelect={(e) => look(e.currentTarget.value, e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(null)}
      />
      {open ? (
        <ul id={listId} role="listbox" className={styles.list} aria-label={open.trigger === '@' ? 'Vendedores' : 'Canales'}>
          <li className={styles.heading} aria-hidden>{open.trigger === '@' ? 'Vendedor' : 'Canal'}</li>
          {open.options.map((o, i) => (
            <li key={o.id} id={`${listId}-${i}`} role="option" aria-selected={i === index}>
              {/* mousedown: choose before the text area loses focus and closes the list */}
              <button type="button" tabIndex={-1} className={styles.option} data-active={i === index || undefined}
                onMouseDown={(e) => { e.preventDefault(); choose(o) }} onMouseEnter={() => setIndex(i)}>
                <Icon size={16} aria-hidden />
                <span className={styles.name}>{o.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
