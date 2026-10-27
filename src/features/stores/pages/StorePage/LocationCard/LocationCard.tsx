import { lazy, Suspense } from 'react'
import { ExternalLink, MapPinOff, RotateCw } from 'lucide-react'
import { mapsSearchUrl } from '@/domain/places'
import { LOCATION_LABEL } from '@/domain/stores'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Skeleton } from '@/ui/Skeleton'
import { useStoreAdmin, type StoreDetail } from '@/features/stores/api/stores'
import styles from './LocationCard.module.scss'

const StoreMap = lazy(() => import('./StoreMap'))

const VERIFY_MESSAGE = {
  verified: { tone: 'ok', text: 'Ubicación verificada: encontramos la dirección con su altura.' },
  approximate: { tone: 'warn', text: 'Encontramos la calle pero no la altura, así que la ubicación es aproximada. Si no es ahí, cargala a mano en "Editar datos".' },
  kept: { tone: 'info', text: 'No encontramos la altura exacta: dejamos la ubicación verificada que ya tenía.' },
  not_found: { tone: 'warn', text: 'No encontramos esa dirección. Revisá cómo está escrita o cargá la ubicación a mano en "Editar datos".' },
} as const

/** Where the store is: the map with its pin, the address, and checking it again. */
export function LocationCard({ store: s, scope, canEdit }: { store: StoreDetail; scope: 'caba' | 'argentina'; canEdit: boolean }) {
  const { verify } = useStoreAdmin(s.id)
  const located = s.lat !== null && s.lng !== null
  const recheck = () => verify.mutate({ address: s.address, area: s.area, scope, current: s.locationStatus })

  return (
    <section className={styles.card} aria-label="Ubicación">
      {located ? (
        <Suspense fallback={<Skeleton height={220} />}>
          <StoreMap lat={s.lat as number} lng={s.lng as number} label={s.name ?? s.address} approximate={s.locationStatus !== 'verified'} />
        </Suspense>
      ) : (
        <div className={styles.noMap}>
          <MapPinOff size={24} aria-hidden />
          <span>Todavía no sabemos dónde está. Verificá la dirección para verlo en el mapa.</span>
        </div>
      )}
      <div className={styles.body}>
        <div className={styles.address}>
          <span className={styles.street}>{s.address}</span>
          <span className={styles.meta}>
            {s.area ?? 'Sin zona'}
            <span className={styles.status} data-status={s.locationStatus}>{LOCATION_LABEL[s.locationStatus]}</span>
          </span>
          {located ? <span className={styles.coords}>{(s.lat as number).toFixed(5)}, {(s.lng as number).toFixed(5)}</span> : null}
        </div>
        <div className={styles.actions}>
          <a className={styles.link} href={mapsSearchUrl(s)} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden />Abrir en Maps</a>
          {canEdit ? (
            <Button variant="ghost" size="md" loading={verify.isPending} onClick={recheck}>
              <RotateCw size={16} aria-hidden />{s.locationStatus === 'verified' ? 'Volver a verificar' : 'Verificar dirección'}
            </Button>
          ) : null}
        </div>
        {verify.data ? <Banner tone={VERIFY_MESSAGE[verify.data].tone}>{VERIFY_MESSAGE[verify.data].text}</Banner> : null}
        {verify.error ? <Banner tone="error">{verify.error.message}</Banner> : null}
      </div>
    </section>
  )
}
