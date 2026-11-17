import { useState } from 'react'
import { PenLine, Trash2, Undo2 } from 'lucide-react'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { ALL_ZONES as ALL, type RouteZone } from '@/features/routeplan/api'
import styles from './ZoneControls.module.scss'


interface ZoneControlsProps {
  zones: RouteZone[]
  /** The saved zone in use, or ALL. */
  zoneId: string
  onZone: (id: string) => void
  /** The corners tapped so far, while drawing; null when not drawing. */
  draft: [number, number][] | null
  onDraw: () => void
  onUndo: () => void
  onCancel: () => void
  onSave: (name: string) => Promise<unknown>
  onRemove: (id: string) => void
  saving: boolean
  error: string | null
}

/** Pick a saved zone, or draw a new one by tapping its corners on the map. */
export function ZoneControls({ zones, zoneId, onZone, draft, onDraw, onUndo, onCancel, onSave, onRemove, saving, error }: ZoneControlsProps) {
  const [name, setName] = useState('')

  if (draft) {
    const ready = draft.length >= 3
    return (
      <div className={styles.drawing}>
        <p className={styles.help}>
          {ready ? `Zona de ${draft.length} esquinas. Seguí tocando para ajustarla, o ponele nombre.` : `Tocá el mapa para marcar las esquinas de la zona (${draft.length} de al menos 3).`}
        </p>
        <div className={styles.row}>
          <Button variant="secondary" size="md" onClick={onUndo} disabled={!draft.length}><Undo2 size={18} aria-hidden />Deshacer</Button>
          <Button variant="ghost" size="md" onClick={onCancel}>Cancelar</Button>
        </div>
        <form className={styles.row} onSubmit={(e) => { e.preventDefault(); if (ready && name.trim()) void onSave(name).then(() => setName('')) }}>
          <Field label="Nombre de la zona" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ej.: Palermo Norte" className={styles.name} />
          <Button type="submit" size="md" disabled={!ready || !name.trim()} loading={saving}>Guardar zona</Button>
        </form>
        {error ? <Banner tone="error">{error}</Banner> : null}
      </div>
    )
  }

  return (
    <div className={styles.row}>
      <div className={styles.pick}>
        <Select label="Zona" value={zoneId} onChange={onZone}
          options={[{ value: ALL, label: 'Toda la empresa' }, ...zones.map((z) => ({ value: z.id, label: z.name }))]} />
      </div>
      {zoneId !== ALL ? (
        <Button variant="ghost" size="md" onClick={() => onRemove(zoneId)} aria-label="Borrar esta zona"><Trash2 size={18} aria-hidden /></Button>
      ) : null}
      <Button variant="secondary" size="md" onClick={onDraw}><PenLine size={18} aria-hidden />Dibujar zona</Button>
    </div>
  )
}
