import { useEffect, useState } from 'react'
import { Camera, Check, ImageIcon } from 'lucide-react'
import { formatTime } from '@/domain/dates'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Field } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { Sheet } from '@/ui/Sheet'
import { Chip } from '@/ui/StatusChip'
import type { Catalogs, Display, Visit } from '@/features/workday/api/queries'
import { PhotoPicker } from '@/features/workday/components/PhotoPicker'
import { PhotoThumb } from '@/features/workday/components/PhotoThumb'
import type { VisitActions } from '../useVisitActions'
import type { ViewerState } from '../VisitPage'
import styles from './DisplaySheet.module.scss'

interface DisplaySheetProps {
  visit: Visit
  display: Display
  index: number
  catalogs: Catalogs
  urlFor: (id: string) => string | undefined
  actions: VisitActions
  onClose: () => void
  onView: (v: ViewerState) => void
  typeName: (id: number) => string
}

/** One display: type, reference, before and after photos (wireframe A10). */
export function DisplaySheet({ visit: v, display: d, index, catalogs, urlFor, actions, onClose, onView, typeName }: DisplaySheetProps) {
  const [reference, setReference] = useState(d.reference ?? '')
  const { confirm, dialog } = useConfirm()
  useEffect(() => setReference(d.reference ?? ''), [d.reference])
  const photos = (kind: 'before' | 'after') => v.photos.filter((p) => p.displayId === d.id && p.kind === kind)
  const after = photos('after')
  const label = typeName(d.typeId)
  const by = d.source === 'found' ? 'Encontrada por vos' : `Indicada${v.addedByName && !v.addedByMe ? ` por ${v.addedByName}` : ''}`

  const strip = (kind: 'before' | 'after') => {
    const list = photos(kind)
    return list.map((p) => (
      <PhotoThumb
        key={p.id}
        photoId={p.id}
        url={urlFor(p.id)}
        caption={formatTime(p.takenAt)}
        label={`Ver foto del ${kind === 'before' ? 'antes' : 'después'}`}
        className={styles.thumb}
        onOpen={() => onView({ photos: list, startId: p.id, title: `${label} · ${kind === 'before' ? 'Antes' : 'Después'}` })}
      />
    ))
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={label}
      subtitle={`${by} · exhibición ${index + 1} de ${v.displays.length}`}
      footer={<Button size="md" onClick={onClose}>Listo</Button>}
    >
      <div className={styles.pair}>
        <Select
          label="Tipo"
          value={d.typeId}
          options={catalogs.displayTypes.map((t) => ({ value: t.id, label: t.name }))}
          onChange={(e) => void actions.changes.patchDisplay(d.id, { typeId: Number(e.target.value) })}
        />
        <Field
          label="Referencia"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          onBlur={() => reference !== (d.reference ?? '') && void actions.changes.patchDisplay(d.id, { reference: reference.trim() || null })}
          placeholder="Ej.: pasillo 3, al lado de cervezas"
          maxLength={120}
        />
      </div>

      <div className={styles.block}>
        <span className={styles.label}>Antes</span>
        <div className={styles.grid}>
          {strip('before')}
          <PhotoPicker className={styles.slot} onPick={(f) => actions.photo(d.id, 'before', f)} disabled={actions.uploading} label="Sacar otra foto del antes">
            <Camera size={20} aria-hidden />
          </PhotoPicker>
          <PhotoPicker className={styles.slot} source="gallery" onPick={(f) => actions.photo(d.id, 'before', f)} disabled={actions.uploading} label="Elegir foto del antes de la galería">
            <ImageIcon size={20} aria-hidden />
          </PhotoPicker>
        </div>
      </div>

      <div className={styles.block}>
        <span className={styles.label}>Después</span>
        {after.length ? (
          <div className={styles.grid}>
            {strip('after')}
            <PhotoPicker className={styles.slot} onPick={(f) => actions.photo(d.id, 'after', f)} disabled={actions.uploading} label="Sacar otra foto del después">
              <Camera size={20} aria-hidden />
            </PhotoPicker>
          </div>
        ) : (
          <PhotoPicker className={styles.afterButton} onPick={(f) => actions.photo(d.id, 'after', f)} disabled={actions.uploading}>
            <Camera size={22} aria-hidden />
            {actions.uploading ? 'Subiendo…' : 'Sacar foto del después'}
          </PhotoPicker>
        )}
        <p className={styles.help}>Al cargar el después, la exhibición queda acomodada.</p>
      </div>

      <div className={styles.footerRow}>
        {after.length ? (
          <Chip tone="done" icon={<Check size={14} strokeWidth={3} aria-hidden />}>Acomodada</Chip>
        ) : (
          <Chip tone="pending">Sin acomodar</Chip>
        )}
        <Button
          variant="danger"
          size="sm"
          onClick={async () => {
            const photoCount = v.photos.filter((p) => p.displayId === d.id).length
            const ok = await confirm({
              title: '¿Quitar esta exhibición?',
              description: photoCount
                ? `${label}${d.reference ? ` (${d.reference})` : ''} sale de la visita junto con sus ${photoCount === 1 ? 'foto' : `${photoCount} fotos`}.`
                : `${label}${d.reference ? ` (${d.reference})` : ''} sale de la visita.`,
              confirmLabel: 'Quitar',
              tone: 'danger',
            })
            if (!ok) return
            await actions.changes.removeDisplay(d.id)
            onClose()
          }}
        >
          Quitar exhibición
        </Button>
      </div>
      {dialog}
    </Sheet>
  )
}
