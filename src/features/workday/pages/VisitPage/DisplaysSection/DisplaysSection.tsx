import { useEffect, useState } from 'react'
import { Camera, Check, Plus } from 'lucide-react'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/StatusChip'
import type { Catalogs, Visit } from '@/features/workday/api/queries'
import { VisitSection } from '@/features/workday/components/VisitSection'
import type { VisitActions } from '../useVisitActions'
import type { ViewerState } from '../VisitPage'
import { DisplaySheet } from '../DisplaySheet'
import styles from './DisplaysSection.module.scss'

interface DisplaysSectionProps {
  visit: Visit
  catalogs: Catalogs
  urlFor: (id: string) => string | undefined
  actions: VisitActions
  openDisplay: { id: string; kind: 'before' | 'after' } | null
  onOpened: () => void
  onView: (v: ViewerState) => void
}

/** Each display counts once; it is arranged when its "after" photo exists. */
export function DisplaysSection({ visit: v, catalogs, urlFor, actions, openDisplay, onOpened, onView }: DisplaysSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  useEffect(() => {
    if (openDisplay) {
      setOpenId(openDisplay.id)
      onOpened()
    }
  }, [openDisplay, onOpened])

  const typeName = (id: number) => catalogs.displayTypes.find((t) => t.id === id)?.name ?? 'Exhibición'
  const count = (displayId: string, kind: 'before' | 'after') => v.photos.filter((p) => p.displayId === displayId && p.kind === kind).length
  const arranged = v.displays.filter((d) => count(d.id, 'after') > 0).length
  const total = v.displays.length
  const open = v.displays.find((d) => d.id === openId)

  const addFound = async () => {
    const first = catalogs.displayTypes[0]
    if (!first) return
    const id = await actions.changes.addDisplay(first.id, total)
    setOpenId(id)
  }

  return (
    <VisitSection
      state={total === 0 ? 'todo' : arranged === total ? 'ok' : 'warn'}
      icon={total && arranged === total ? <Check size={16} strokeWidth={3} /> : <span>{arranged}/{total}</span>}
      title="Exhibiciones"
      subtitle={total ? `${arranged} de ${total} acomodadas` : 'Sin exhibiciones indicadas'}
    >
      {total ? (
        <ul className={styles.list}>
          {v.displays.map((d, i) => {
            const before = count(d.id, 'before')
            const after = count(d.id, 'after')
            const cover = v.photos.filter((p) => p.displayId === d.id).at(-1)
            const url = cover ? urlFor(cover.id) : undefined
            return (
              <li key={d.id}>
                <button type="button" className={styles.item} onClick={() => setOpenId(d.id)} aria-label={`Exhibición ${i + 1}: ${typeName(d.typeId)}`}>
                  <span className={styles.thumb}>{url ? <img src={url} alt="" /> : null}</span>
                  <span className={styles.text}>
                    <span className={styles.name}>{[typeName(d.typeId), d.reference].filter(Boolean).join(' · ')}</span>
                    <span className={styles.by}>
                      {d.source === 'found' ? 'Encontrada' : 'Indicada'} · {before ? `${before} antes` : 'sin antes'} · {after ? `${after} después` : 'sin después'}
                    </span>
                  </span>
                  {after ? (
                    <Chip tone="done" icon={<Check size={14} strokeWidth={3} aria-hidden />}>Lista</Chip>
                  ) : (
                    <span className={styles.cameraIcon} aria-hidden><Camera size={18} /></span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      <Button variant="ghost" size="md" className={styles.add} onClick={addFound} disabled={!catalogs.displayTypes.length}>
        <Plus size={18} aria-hidden />Encontré otra exhibición
      </Button>

      {open ? (
        <DisplaySheet
          visit={v}
          display={open}
          index={v.displays.indexOf(open)}
          catalogs={catalogs}
          urlFor={urlFor}
          actions={actions}
          onClose={() => setOpenId(null)}
          onView={onView}
          typeName={typeName}
        />
      ) : null}
    </VisitSection>
  )
}
