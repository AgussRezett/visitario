import { Link } from '@tanstack/react-router'
import { Camera, Check, Copy, FileText, Map, PartyPopper } from 'lucide-react'
import type { workdayProgress } from '@/domain/visit'
import { useCopy } from '@/lib/share'
import { useCatalogs, type Visit } from '@/features/workday/api/queries'
import { StoreTagsLine } from '@/features/workday/components/StoreTagsLine'
import { storeTags } from '@/features/workday/store-tags'
import { mapsUrl, originLabel } from '@/features/workday/visit-text'
import styles from './DayHero.module.scss'

interface DayHeroProps {
  progress: ReturnType<typeof workdayProgress>
  next: Visit | undefined
  stop: number
  date: string
}

/** The day at a glance: progress, and the next store with what to do there. */
export function DayHero({ progress, next, stop, date }: DayHeroProps) {
  const { copied, copy } = useCopy()
  const catalogs = useCatalogs(next?.companyId ?? '').data
  const share = progress.total ? progress.visited / progress.total : 0

  return (
    <section className={styles.hero} aria-label="Siguiente parada">
      <div className={styles.progress}>
        <div className={styles.progressText}>
          <span className={styles.count}>
            <b>{progress.visited}</b> de {progress.total} visitados
          </span>
          <span className={styles.percent}>{progress.percent} %</span>
        </div>
        <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.visited} aria-label="Avance del día">
          <i style={{ width: `${share * 100}%` }} />
        </div>
      </div>

      {next ? (
        <>
          <div className={styles.stop}>
            <span className={styles.stopLabel}>
              {next.workStatus === 'in_progress' ? 'Estás en' : 'Siguiente'} · parada {stop}
            </span>
            <span className={styles.name}>{next.store.name ?? next.store.address}</span>
            <span className={styles.soft}>
              {[next.store.name ? next.store.address : null, next.store.area, next.store.customerNumber && `Cliente ${next.store.customerNumber}`].filter(Boolean).join(' · ')}
            </span>
            {next ? <StoreTagsLine tags={storeTags(catalogs, next.store)} className={styles.tags} /> : null}
            <span className={styles.meta}>
              {[next.task, next.displays.length ? `${next.displays.length} ${next.displays.length === 1 ? 'exhibición' : 'exhibiciones'}` : null, originLabel(next)].filter(Boolean).join(' · ')}
            </span>
          </div>
          <div className={styles.actions}>
            <Link to="/visit/$visitId" params={{ visitId: next.id }} className={styles.primary}>
              {next.workStatus === 'pending' ? <><Camera size={20} aria-hidden />Marcar llegada</> : 'Seguir con la visita'}
            </Link>
            <a className={styles.icon} href={mapsUrl(next)} target="_blank" rel="noreferrer" aria-label="Abrir en Google Maps">
              <Map size={20} aria-hidden />
            </a>
            <button type="button" className={styles.icon} onClick={() => copy('address', next.store.address)} aria-label="Copiar dirección">
              {copied === 'address' ? <Check size={20} aria-hidden /> : <Copy size={20} aria-hidden />}
            </button>
          </div>
        </>
      ) : progress.total ? (
        <div className={styles.done}>
          <PartyPopper size={28} aria-hidden className={styles.doneIcon} />
          <div className={styles.stop}>
            <span className={styles.name}>Terminaste el día</span>
            <span className={styles.soft}>Todos los locales tienen resultado. Revisá el informe antes de cerrar.</span>
          </div>
          <Link to="/s/report" search={{ date }} className={styles.primary}>
            <FileText size={20} aria-hidden />Ver informe del día
          </Link>
        </div>
      ) : null}
    </section>
  )
}
