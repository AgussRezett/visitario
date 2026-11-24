import { useCallback, useEffect, useMemo, useState } from 'react'
import { keepEdits, rowProblem, rowsFromLines, type ReviewRow } from '@/domain/add-review'
import { briefLines, taskKey, type UnderstoodBrief } from '@/domain/brief'
import { todayInArgentina } from '@/domain/dates'
import type { Mentionable } from '@/domain/mentions'
import { overlapText } from '@/domain/overlaps'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import type { WorkContext } from '@/features/workday/context'
import { useAddVisits } from '@/features/workday/api/mutations'
import { useDayOverlaps } from '@/features/workday/api/overlaps'
import { MentionTextArea } from '@/features/workday/components/MentionTextArea'
import { channelIdOf } from './channel-choice'
import { pastedHelp, readLines } from './paste-lines'
import { outcomeText, pasteOutcome, repeatedLines } from './paste-results'
import { PasteSources } from './PasteSources'
import { ReviewStep } from './ReviewStep'
import styles from './AddAddressSheet.module.scss'

interface ManyStoresInput {
  open: boolean
  ctx: WorkContext
  workdayId: string
  date: string
  online: boolean
  sellers: readonly Mentionable[]
  channels: readonly Mentionable[]
  onAddSeller?: (name: string) => Promise<Mentionable>
  onClose: () => void
}

/**
 * Several stores at once: pasted one per line, or read by AI from captures and files. Either
 * way they go to a review, one row each with every part editable, before adding them all.
 */
export function useManyStores({ open, ctx, workdayId, date, online, sellers, channels, onAddSeller, onClose }: ManyStoresInput) {
  const [step, setStep] = useState<'paste' | 'review'>('paste')
  const [pasted, setPasted] = useState('')
  /** Read from a PDF: each line's task, and what was understood. */
  const [tasks, setTasks] = useState<Record<string, string>>({})
  const [brief, setBrief] = useState<UnderstoodBrief | null>(null)
  /** Rows read from captures, as the AI left them. */
  const [readRows, setReadRows] = useState<ReviewRow[]>([])
  /** The review as edited; removed rows stay out if the list is built again. */
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<Map<string, string>>(new Map())
  const [summary, setSummary] = useState<string | null>(null)
  /** What the AI said of the last capture: how many it read, and rows it could not. */
  const [readSaid, setReadSaid] = useState<string | null>(null)
  const addMany = useAddVisits(workdayId)

  useEffect(() => {
    if (!open) return
    setStep('paste')
    setPasted('')
    setTasks({})
    setBrief(null)
    setReadRows([])
    setRows([])
    setRemoved(new Set())
    setFailed(new Map())
    setSummary(null)
    setReadSaid(null)
    addMany.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the sheet opens
  }, [open])

  const lines = readLines(pasted, sellers, channels)
  const fresh = () => [...rowsFromLines(lines, (a) => tasks[taskKey(a)] ?? ''), ...readRows]
  const count = fresh().filter((r) => !removed.has(r.key)).length

  const review = (extra: ReviewRow[] = []) => {
    setRows((before) => keepEdits([...fresh(), ...extra], before, removed))
    setStep('review')
  }
  // A capture read by AI goes straight to the review.
  const onRows = (read: ReviewRow[], note: string) => {
    setReadRows((r) => [...r, ...read])
    setReadSaid(note)
    review(read)
  }
  const addLines = (read: string[]) => setPasted((p) => [p.trim(), ...read].filter(Boolean).join('\n'))
  const readPdf = (b: UnderstoodBrief) => {
    const read = briefLines(b, sellers)
    addLines(read.map((l) => l.text))
    setTasks((t) => ({ ...t, ...Object.fromEntries(read.map((l) => [l.key, l.task])) }))
    setBrief(b)
  }
  const remove = useCallback((key: string) => {
    setRows((all) => all.filter((r) => r.key !== key))
    setRemoved((s) => new Set(s).add(key))
  }, [])

  // Who else already has these stores that day, and the same store twice in the list.
  const when = date === todayInArgentina() ? 'de hoy' : 'de ese día'
  const overlaps = useDayOverlaps(workdayId, rows.map((r) => ({ address: r.address, customerNumber: r.customerNumber })), open && step === 'review' && online)
  const notes = useMemo(() => {
    const out = new Map<string, string[]>()
    const push = (key: string, t: string) => out.set(key, [...(out.get(key) ?? []), t])
    for (const [i, first] of repeatedLines(rows)) if (rows[i]) push(rows[i].key, `Repite el local ${first + 1}: se agrega una vez.`)
    for (const [i, list] of overlaps.data ?? []) {
      const text = overlapText(list, when)
      if (rows[i] && text) push(rows[i].key, text)
    }
    for (const [key, reason] of failed) push(key, reason)
    return out
  }, [rows, overlaps.data, failed, when])

  const ready = rows.length > 0 && rows.every((r) => !rowProblem(r, channels.length > 0))
  const add = async () => {
    setSummary(null)
    const sent = rows
    const results = await addMany.mutateAsync(sent.map((r) => ({
      customerNumber: r.customerNumber.trim(), address: r.address.trim(), area: r.area.trim(), sellerId: r.sellerId, channelId: channelIdOf(r.channel), task: r.task || undefined,
    })))
    const outcome = pasteOutcome(sent.map((r) => r.key), results, repeatedLines(sent))
    if (!outcome.failed.length) return onClose()
    // What did not go in stays, with why, to fix it and try again.
    const left = new Map(outcome.failed.map((f) => [f.text, f.reason]))
    setRows(sent.filter((r) => left.has(r.key)))
    setFailed(left)
    setSummary(`${outcomeText(outcome)}. ${left.size === 1 ? 'Falta 1: corregilo y tocá Agregar' : `Faltan ${left.size}: corregilos y tocá Agregar`}.`)
  }

  const body = step === 'paste' ? (
    <>
      {/* Self-employed accounts have no plan with AI. */}
      {ctx.personal ? null : (
        <PasteSources companyId={ctx.companyId} sellers={sellers} channels={channels} disabled={!online} day={date} brief={brief} onRows={onRows} onBrief={readPdf} />
      )}
      {readRows.length ? (
        <p className={styles.help}>{readRows.length === 1 ? '1 local leído' : `${readRows.length} locales leídos`} de capturas: los ves en la revisión.</p>
      ) : null}
      <MentionTextArea
        label="Direcciones"
        value={pasted}
        onChange={setPasted}
        sellers={sellers}
        channels={channels}
        onAddSeller={onAddSeller}
        rows={8}
        placeholder={'Una por línea. Nro. de cliente y zona, si los tenés:\n20114; Amenábar 1260; Belgrano @vendedor\nMoldes 1365'}
        help={pastedHelp(lines, true)}
      />
    </>
  ) : (
    <>
      {summary ? <Banner tone="warn">{summary}</Banner> : readSaid ? <Banner tone="info">{readSaid}</Banner> : null}
      <ReviewStep rows={rows} onRows={setRows} onRemove={remove} sellers={sellers} channels={channels} onAddSeller={onAddSeller} notes={notes} />
      {addMany.isPending ? <p className={styles.help}>Agregando {rows.length} {rows.length === 1 ? 'local' : 'locales'}…</p> : null}
      {addMany.error ? <Banner tone="error">{addMany.error.message}</Banner> : null}
    </>
  )

  const footer = step === 'paste' ? (
    <>
      <Button variant="secondary" size="md" className={styles.cancel} onClick={onClose}>Cancelar</Button>
      <Button size="md" disabled={!count} onClick={() => review()}>
        Revisar {count || ''} {count === 1 ? 'local' : 'locales'}
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" size="md" onClick={() => setStep('paste')}>Volver</Button>
      <Button size="md" disabled={!ready || !online} loading={addMany.isPending} onClick={() => void add().catch(() => undefined)}>
        Agregar {rows.length || ''} {rows.length === 1 ? 'local' : 'locales'}
      </Button>
    </>
  )

  return { body, footer, step }
}
