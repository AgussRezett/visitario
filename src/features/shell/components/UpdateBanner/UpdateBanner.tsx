import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { applyUpdate, useUpdateReady } from '@/app/pwa'
import styles from './UpdateBanner.module.scss'

/** A row of the shell grid, shown only when a new version is downloaded and waiting. */
export function UpdateBanner() {
  const ready = useUpdateReady()
  const [updating, setUpdating] = useState(false)
  if (!ready) return null
  return (
    <div role="status" className={styles.banner}>
      <RefreshCw size={18} aria-hidden className={styles.icon} />
      <p className={styles.text}>Hay una versión nueva de Visitario</p>
      <button
        type="button"
        className={styles.action}
        disabled={updating}
        onClick={() => {
          setUpdating(true)
          applyUpdate()
        }}
      >
        {updating ? 'Actualizando…' : 'Actualizar'}
      </button>
    </div>
  )
}
