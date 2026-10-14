import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { Car, Check, Footprints, LocateFixed, Route as RouteIcon, TriangleAlert } from 'lucide-react'
import { formatTime } from '@/domain/dates'
import type { Point, TravelMode } from '@/domain/route'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Select } from '@/ui/Select'
import type { Visit } from '@/features/workday/api/queries'
import { currentPosition } from '../../api'
import { placeName, stopNote } from './stop'
import styles from './RoutePage.module.scss'

export interface RouteOptions {
  mode: TravelMode
  origin: (Point & { at: string }) | null
  /** 'auto': from my location, or the first store of the day without it. */
  firstId: string
  /** null: the default (a store closed earlier goes last). */
  lastId: string | null
  /** Stores left out of the route this time. */
  left: string[]
}

interface RouteSetupProps {
  options: RouteOptions & { lastId: string }
  onChange: (next: Partial<RouteOptions>) => void
  candidates: Visit[]
  selected: Visit[]
  missing: Visit[]
  busy: boolean
  onCalculate: () => void
}

/** How to go, where from, first and last store, and which stores (wireframe A07). */
export function RouteSetup({ options, onChange, candidates, selected, missing, busy, onCalculate }: RouteSetupProps) {
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  const storeOptions = selected.map((v) => ({ value: v.id, label: placeName(v) }))

  const locate = async () => {
    if (options.origin) return onChange({ origin: null })
    setLocating(true)
    setLocError('')
    try {
      const p = await currentPosition()
      onChange({ origin: { ...p, at: new Date().toISOString() }, firstId: 'auto' })
    } catch {
      setLocError('No pudimos tomar tu ubicación. El recorrido arranca desde el primer local.')
    } finally {
      setLocating(false)
    }
  }
  const toggle = (id: string, on: boolean) => onChange({ left: on ? options.left.filter((x) => x !== id) : [...options.left, id] })

  return (
    <section className={styles.card} aria-label="Cómo vas">
      <h2 className={styles.cardTitle}>Cómo vas</h2>
      <div role="radiogroup" aria-label="Transporte" className={styles.modes}>
        <button type="button" role="radio" aria-checked={options.mode === 'driving'} onClick={() => onChange({ mode: 'driving' })}><Car size={18} aria-hidden />Auto</button>
        <button type="button" role="radio" aria-checked={options.mode === 'walking'} onClick={() => onChange({ mode: 'walking' })}><Footprints size={18} aria-hidden />A pie</button>
      </div>

      <button type="button" className={styles.locate} aria-pressed={Boolean(options.origin)} onClick={() => void locate()} disabled={locating}>
        <LocateFixed size={20} aria-hidden className={styles.locateIcon} />
        <span className={styles.locateText}>
          <span className={styles.locateTitle}>{locating ? 'Buscando tu ubicación…' : 'Empezar desde mi ubicación'}</span>
          <span className={styles.locateHelp}>{options.origin ? `Ubicación tomada ${formatTime(options.origin.at)} · tocá para quitarla` : 'Opcional. Solo se usa para este cálculo.'}</span>
        </span>
        {options.origin ? <Check size={20} aria-hidden className={styles.locateIcon} /> : null}
      </button>
      {locError ? <p className={styles.help} role="status">{locError}</p> : null}

      <div className={styles.ends}>
        <Select
          label="Primer local"
          value={options.firstId}
          onChange={(e) => onChange({ firstId: e.target.value })}
          options={[{ value: 'auto', label: 'Automático' }, ...storeOptions]}
        />
        <Select
          label="Último local"
          value={options.lastId}
          onChange={(e) => onChange({ lastId: e.target.value })}
          options={[{ value: 'auto', label: 'El que convenga' }, ...storeOptions.filter((o) => o.value !== options.firstId)]}
        />
      </div>

      {!options.origin && options.firstId === 'auto' ? <p className={styles.help}>Sin tu ubicación, arranca por el primer local de la jornada.</p> : null}

      {missing.length ? (
        <Banner tone="warn" icon={<TriangleAlert size={18} aria-hidden />} title={missing.length === 1 ? '1 local sin ubicación' : `${missing.length} locales sin ubicación`}>
          {missing.map((v, i) => (
            <span key={v.id}>
              {i ? ', ' : ''}{placeName(v)} · <Link to="/visit/$visitId" params={{ visitId: v.id }} className={styles.inlineLink}>verificar dirección</Link>
            </span>
          ))}
          <span className={styles.block}>Quedan fuera del recorrido hasta que tengan ubicación.</span>
        </Banner>
      ) : null}

      <div className={styles.listHead}>
        <span className={styles.eyebrow}>Locales a visitar · {selected.length} de {candidates.length}</span>
        <button type="button" className={styles.textButton} onClick={() => onChange({ left: selected.length ? candidates.map((v) => v.id) : [] })}>
          {selected.length ? 'Ninguno' : 'Todos'}
        </button>
      </div>
      <ul className={styles.choices}>
        {candidates.map((v) => (
          <li key={v.id}>
            <label className={styles.choice}>
              <input type="checkbox" checked={!options.left.includes(v.id)} onChange={(e) => toggle(v.id, e.target.checked)} />
              <span className={styles.choiceText}>
                <span className={styles.choiceName}>{placeName(v)}</span>
                <span className={styles.choiceNote}>{stopNote(v)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className={styles.help}>Las visitas aprobadas, terminadas o no autorizadas no entran en el recorrido.</p>

      <div className={clsx(styles.footer, styles.footerCard)}>
        <Button onClick={onCalculate} disabled={!selected.length} loading={busy}><RouteIcon size={20} aria-hidden />Calcular mejor orden</Button>
      </div>
    </section>
  )
}
