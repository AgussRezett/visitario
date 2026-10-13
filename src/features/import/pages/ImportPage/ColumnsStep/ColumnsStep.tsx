import { Table2 } from 'lucide-react'
import { FIELD_LABELS, guessMapping, type ImportField, type Person } from '@/domain/import'
import { useIsDesktop } from '@/lib/useMedia'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Segmented } from '@/ui/Segmented'
import { Select } from '@/ui/Select'
import { Table } from '@/ui/Table'
import type { SavedFormat } from '@/features/import/api/import'
import { tableOf, withSheets, type Draft, type NameCheck } from '@/features/import/draft'
import { PeopleBox } from '../PeopleBox'
import { StepFrame } from '../StepFrame'
import styles from './ColumnsStep.module.scss'

interface ColumnsStepProps {
  draft: Draft
  formats: SavedFormat[]
  people: Person[]
  names: NameCheck[]
  rows: number
  update: (change: Partial<Draft>) => void
  setColumn: (i: number, field: ImportField) => void
  setAlias: (name: string, personId: string) => void
  onBack: () => void
  onNext: () => void
}

const FIELD_OPTIONS = (Object.keys(FIELD_LABELS) as ImportField[]).map((f) => ({ value: f, label: FIELD_LABELS[f] }))
const SAMPLE_ROWS = 4

/** Step 2: what each column holds (S04 / SM04). */
export function ColumnsStep({ draft, formats, people, names, rows, update, setColumn, setAlias, onBack, onNext }: ColumnsStepProps) {
  const desktop = useIsDesktop()
  const table = tableOf(draft)
  const { hasHeader, columns } = draft.mapping
  const headers = hasHeader ? table[0] ?? [] : []
  const body = (hasHeader ? table.slice(1) : table).slice(0, SAMPLE_ROWS)
  const title = (i: number) => headers[i] || `Columna ${i + 1}`
  const canReview = columns.includes('address') || columns.includes('customer_number')
  const select = (i: number) => (
    <Select
      label={`Qué hay en ${title(i)}`}
      options={FIELD_OPTIONS}
      value={columns[i] ?? 'ignore'}
      onChange={(e) => setColumn(i, e.target.value as ImportField)}
      className={styles.select}
      data-field={columns[i]}
    />
  )

  return (
    <StepFrame
      step={2}
      kind="Importar planilla"
      title="¿Qué hay en cada columna?"
      onBack={onBack}
      backLabel="Elegir otra planilla"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onBack} className={styles.cancel}>Volver</Button>
          <Button size="md" disabled={!canReview || !rows} onClick={onNext}>Revisar {rows} {rows === 1 ? 'fila' : 'filas'}</Button>
        </>
      }
    >
      <div className={styles.file}>
        <Table2 size={22} aria-hidden className={styles.fileIcon} />
        <span className={styles.fileText}>
          <span className={styles.fileName}>{draft.fileName ?? 'Texto pegado'}</span>
          <span className={styles.fileMeta}>
            {draft.sheets.length > 1 ? `Hoja "${draft.sheets[draft.sheet]?.name}" · ` : ''}{rows} filas · {table[0]?.length ?? 0} columnas
          </span>
        </span>
        {draft.sheets.length > 1 ? (
          <Select
            label="Hoja"
            options={draft.sheets.map((s, i) => ({ value: i, label: s.name }))}
            value={draft.sheet}
            onChange={(e) => update(withSheets(draft, draft.fileName, draft.sheets, Number(e.target.value), formats))}
          />
        ) : null}
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={hasHeader}
            onChange={(e) => update({ mapping: { ...draft.mapping, hasHeader: e.target.checked, columns: guessMapping(table, e.target.checked) } })}
          />
          La primera fila son títulos
        </label>
      </div>

      {desktop ? (
        <Table label="Columnas de la planilla" className={styles.table}>
          <thead>
            <tr>{columns.map((_, i) => <th key={i} className={styles.selectCell}>{select(i)}</th>)}</tr>
            {hasHeader ? <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr> : null}
          </thead>
          <tbody>
            {body.map((r, j) => (
              <tr key={j}>{r.map((c, i) => <td key={i} data-ignored={columns[i] === 'ignore' || undefined}>{c}</td>)}</tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className={styles.cards}>
          {columns.map((_, i) => (
            <div key={i} className={styles.columnCard}>
              <div className={styles.columnHead}>
                <span className={styles.columnTitle}>{title(i)}</span>
                <span className={styles.columnSample}>{body.map((r) => r[i]).filter(Boolean).slice(0, 2).join(' · ')}</span>
              </div>
              {select(i)}
            </div>
          ))}
        </div>
      )}

      <div className={styles.cards2}>
        {columns.includes('merchandiser') ? (
          <PeopleBox names={names} people={people} onConfirm={setAlias} />
        ) : (
          <p className={styles.note}>Sin columna de activador, todo va a quien elijas en la revisión.</p>
        )}
        <section className={styles.settings} aria-label="Ajustes">
          <span className={styles.settingsLabel} aria-hidden>Dónde buscar direcciones</span>
          <Segmented
            label="Dónde buscar direcciones"
            value={draft.mapping.scope}
            onChange={(scope) => update({ mapping: { ...draft.mapping, scope } })}
            options={[{ value: 'caba', label: 'CABA' }, { value: 'argentina', label: 'Toda Argentina' }]}
          />
          {hasHeader ? (
            <>
              <label className={styles.check}>
                <input type="checkbox" checked={draft.saveFormat} onChange={(e) => update({ saveFormat: e.target.checked })} />
                Guardar como formato
              </label>
              {draft.saveFormat ? (
                <Field label="Nombre del formato" value={draft.formatName} onChange={(e) => update({ formatName: e.target.value })} maxLength={60} help="La próxima planilla con estas columnas se reconoce sola." />
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </StepFrame>
  )
}
