import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, RotateCw, Sparkles, X } from 'lucide-react'
import { signatureOf, type ImportRow, type Person, type RowStatus } from '@/domain/import'
import { formatLongDate } from '@/domain/dates'
import { findByName, type Mentionable } from '@/domain/mentions'
import { useIsDesktop } from '@/lib/useMedia'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Field } from '@/ui/Field'
import { Segmented } from '@/ui/Segmented'
import { Select } from '@/ui/Select'
import { matchQuery, useRunImport, type ImportPayloadRow, type ImportResult } from '@/features/import/api/import'
import { reviewRows, tableOf, type Draft, type NameCheck, type ReviewRow } from '@/features/import/draft'
import { useLocate } from '@/features/import/locate'
import { PeopleBox } from '../PeopleBox'
import { StepFrame } from '../StepFrame'
import { RowResult } from './RowResult'
import styles from './ReviewStep.module.scss'

interface ReviewStepProps {
  companyId: string
  draft: Draft
  rows: ImportRow[]
  people: Person[]
  names: NameCheck[]
  /** The company's sellers and channels, to read those columns. */
  tags: { sellers: readonly Mentionable[]; channels: readonly (Mentionable & { number?: number })[] }
  date: string
  onDate: (date: string) => void
  update: (change: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => void
  setAlias: (name: string, personId: string) => void
  onBack: () => void
  onDiscard: () => void
  onImported: (result: ImportResult) => void
}

type Tab = 'all' | RowStatus

const STATUS_LABEL: Record<RowStatus, string> = { recognized: 'Reconocida', new: 'Nueva', review: 'Revisar' }

/** Step 3: what is already in the directory, what is new, what needs a look (S05 / SM05). */
export function ReviewStep({ companyId, draft, rows, people, names, tags, date, onDate, update, setAlias, onBack, onDiscard, onImported }: ReviewStepProps) {
  const desktop = useIsDesktop()
  const [tab, setTab] = useState<Tab>('all')
  const { confirm, dialog } = useConfirm()
  const run = useRunImport(companyId)
  const matches = useQuery(matchQuery(companyId, rows))
  const all = useMemo(() => reviewRows(rows, matches.data, people, draft), [rows, matches.data, people, draft])
  const visible = all.filter((r) => !draft.skipped.includes(r.line))
  const located = useLocate(matches.data ? visible.filter((r) => r.status === 'new').map((r) => r.address) : [], draft.mapping.scope)
  const count = (s: RowStatus) => visible.filter((r) => r.status === s).length
  const ready = visible.filter((r) => r.status !== 'review')
  const shown = tab === 'all' ? visible : visible.filter((r) => r.status === tab)
  const unsure = names.some((n) => n.match.kind !== 'sure')
  const targets = [...new Map(ready.map((r) => [r.person?.id, r.person])).values()].filter((p): p is Person => Boolean(p))
  const skipped = draft.skipped.length
  const sellerOf = (r: ImportRow) => (r.seller ? findByName(r.seller, tags.sellers) : null)
  const channelOf = (r: ImportRow) => (r.channel ? findByName(r.channel, tags.channels) : null)
  // Names in the seller or channel columns that are no one: imported without it.
  const unknownSellers = [...new Set(ready.filter((r) => r.seller && !sellerOf(r)).map((r) => r.seller))]
  const unknownChannels = [...new Set(ready.filter((r) => r.channel && !channelOf(r)).map((r) => r.channel))]

  const skip = (line: number) => update((d) => ({ skipped: [...d.skipped, line] }))
  const edit = (line: number, address: string) => update((d) => ({ edits: { ...d.edits, [line]: address } }))

  const payload = (r: ReviewRow): ImportPayloadRow => {
    const base = {
      merchandiser: r.person?.id ?? '', task: r.task || undefined, customer_number: r.customerNumber || undefined, name: r.name || undefined,
      seller: sellerOf(r)?.id, channel: channelOf(r)?.id,
    }
    if (r.match) return { ...base, store: r.match.storeId }
    const place = located.get(r.address)
    return {
      ...base,
      address: r.address,
      area: r.area || place?.area || undefined,
      ...(place ? { lat: place.lat, lng: place.lng, location_status: place.exact ? 'verified' : 'approximate' } : {}),
    }
  }

  const save = async () => {
    const left = count('review')
    if (left) {
      const ok = await confirm({
        title: `${left} ${left === 1 ? 'fila queda' : 'filas quedan'} afuera`,
        description: 'Las filas para revisar no se agregan. Podés resolverlas antes o sumarlas después a mano.',
        confirmLabel: `Agregar ${ready.length}`,
      })
      if (!ok) return
    }
    const header = tableOf(draft)[0] ?? []
    const format = !draft.lines && draft.mapping.hasHeader && draft.saveFormat && draft.formatName.trim()
      ? { name: draft.formatName.trim(), signature: signatureOf(header), mapping: draft.mapping }
      : null
    onImported(await run.mutateAsync({ date, rows: ready.map(payload), format }))
  }

  const discard = async () => {
    if (await confirm({ title: '¿Descartar la importación?', description: 'No se crea nada: ni comercios ni jornadas.', confirmLabel: 'Descartar', tone: 'danger' })) onDiscard()
  }

  const target = targets.length === 1 ? `a la jornada de ${targets[0]?.firstName}` : `a ${targets.length} jornadas`
  const settings = (
    <div className={styles.settings}>
      <Select
        label="Para"
        options={[{ value: '', label: 'Elegir activador…' }, ...people.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}${p.me ? ' (vos)' : ''}` }))]}
        value={draft.fallback ?? ''}
        onChange={(e) => update({ fallback: e.target.value || null })}
      />
      <Field label="Fecha" type="date" value={date} onChange={(e) => e.target.value && onDate(e.target.value)} />
    </div>
  )

  return (
    <StepFrame
      step={3}
      kind={draft.lines ? 'Pegar texto' : 'Importar planilla'}
      title="Revisá antes de guardar"
      onBack={onBack}
      backLabel={draft.lines ? 'Cambiar el texto' : 'Cambiar columnas'}
      aside={desktop ? settings : undefined}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={discard} className={styles.discard}>Descartar</Button>
          <Button size="md" disabled={!ready.length || matches.isPending} loading={run.isPending} onClick={save} aria-label={matches.isPending ? undefined : `Agregar ${ready.length} ${target}`}>
            <Check size={18} aria-hidden />
            {matches.isPending ? 'Buscando…' : !ready.length ? 'Agregar' : desktop ? `Agregar ${ready.length} ${target}` : targets.length === 1 ? `Agregar ${ready.length} a ${targets[0]?.firstName}` : `Agregar ${ready.length}`}
          </Button>
        </>
      }
    >
      {desktop ? null : settings}
      {draft.format ? (
        <Banner tone="ok" icon={<Sparkles size={18} aria-hidden />}>
          Formato "{draft.format.name}" reconocido: las columnas ya están elegidas.
        </Banner>
      ) : null}
      {draft.capture ? (
        <Banner tone="info" icon={<Sparkles size={18} aria-hidden />} title="Leído de una captura con IA">
          La IA solo propone filas: revisá las direcciones contra la captura.
          {draft.capture.unreadable ? ` No pudo leer ${draft.capture.unreadable === 1 ? '1 fila: agregala' : `${draft.capture.unreadable} filas: agregalas`} a mano.` : ''}
        </Banner>
      ) : null}
      <p className={styles.help}>Nada se crea ni se asigna hasta que confirmes. Va al borrador del {formatLongDate(date).toLowerCase()}: lo publicás desde Asignar.</p>
      {run.error ? <Banner tone="error">{run.error.message}</Banner> : null}
      {matches.error ? <Banner tone="error">No pudimos buscar en el directorio. Revisá la conexión y volvé a intentar.</Banner> : null}
      {unknownSellers.length || unknownChannels.length ? (
        <Banner tone="warn" title="Algunos datos no están en Catálogos">
          {[unknownSellers.length ? `Vendedores: ${unknownSellers.join(', ')}.` : '', unknownChannels.length ? `Canales: ${unknownChannels.join(', ')}.` : ''].filter(Boolean).join(' ')} Esos locales se agregan sin ese dato; cargalos en Catálogos y volvé a importar, o completalos desde el directorio.
        </Banner>
      ) : null}
      {unsure ? <PeopleBox names={names} people={people} onConfirm={setAlias} /> : null}

      <div className={styles.summary}>
        <span className={styles.kpi}><b>{count('recognized')}</b> {count('recognized') === 1 ? 'reconocida' : 'reconocidas'}</span>
        <span className={styles.kpi}><b>{count('new')}</b> {count('new') === 1 ? 'nueva' : 'nuevas'}</span>
        <span className={styles.kpi} data-tone="fix"><b>{count('review')}</b> para revisar</span>
      </div>

      <Segmented
        label="Filas"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: desktop ? `Todas · ${visible.length}` : 'Todas' },
          { value: 'review', label: desktop ? `Revisar · ${count('review')}` : 'Revisar' },
          { value: 'new', label: desktop ? `Nuevas · ${count('new')}` : 'Nuevas' },
          { value: 'recognized', label: desktop ? `Reconocidas · ${count('recognized')}` : 'Reconocidas' },
        ]}
      />

      <ul className={styles.rows} aria-label="Filas a importar">
        {shown.map((r) => (
          <li key={r.line} className={styles.row} data-status={r.status}>
            <span className={styles.read}>
              {r.line in draft.edits || (r.status === 'review' && !r.match && r.address.length < 3) ? (
                <Field
                  label={`Dirección de la fila ${r.line}`}
                  defaultValue={draft.edits[r.line] ?? ''}
                  onBlur={(e) => edit(r.line, e.target.value.trim())}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  placeholder="Escribí la dirección"
                />
              ) : (
                <>
                  <span className={styles.address}>{r.address || `Cliente ${r.customerNumber}`}</span>
                  <span className={styles.line}>
                    {[`Fila ${r.line}`, r.person?.firstName, channelOf(r)?.name, sellerOf(r) && `vend. ${sellerOf(r)?.name}`].filter(Boolean).join(' · ')}
                  </span>
                </>
              )}
            </span>
            <span className={styles.resultCell}>
              <RowResult row={r} place={located.get(r.address)} />
              {r.status === 'new' && located.get(r.address) === null ? (
                <Button variant="ghost" size="sm" className={styles.retry} onClick={() => located.retry(r.address)}><RotateCw size={16} aria-hidden />Reintentar</Button>
              ) : null}
            </span>
            <span className={styles.side}>
              <span className={styles.chip} data-status={r.status}>{STATUS_LABEL[r.status]}</span>
            </span>
            <Button variant="ghost" size="md" className={styles.skip} onClick={() => skip(r.line)} aria-label={`Quitar la fila ${r.line}`}>
              <X size={16} aria-hidden />Quitar
            </Button>
          </li>
        ))}
        {!shown.length ? <li className={styles.empty}>Nada en esta pestaña.</li> : null}
      </ul>
      {skipped ? (
        <button type="button" className={styles.restore} onClick={() => update({ skipped: [] })}>
          {skipped} {skipped === 1 ? 'fila quitada' : 'filas quitadas'} · Volver a mostrarlas
        </button>
      ) : null}
      <p className={styles.help}>
        {located.pending
          ? `Ubicando ${located.pending} ${located.pending === 1 ? 'dirección' : 'direcciones'} en el mapa… Si agregás ahora, esas quedan para verificar.`
          : 'Las filas sin ubicación exacta se guardan igual y quedan para verificar.'}
      </p>
      {dialog}
    </StepFrame>
  )
}
