import { useState } from 'react'
import { ChevronRight, Download, MonitorSmartphone } from 'lucide-react'
import { useInstall } from '@/features/install/state'
import { InstallSheet } from '@/features/install/components/InstallSheet'
import styles from './InstallRow.module.scss'

/** In the profile: the install guide is always here, also after "Ahora no". */
export function InstallRow() {
  const { kind } = useInstall()
  const [open, setOpen] = useState(false)
  const installed = kind === 'installed'
  return (
    <>
      <button type="button" className={styles.row} onClick={() => setOpen(true)}>
        <span className={styles.icon} aria-hidden>{installed ? <MonitorSmartphone size={20} /> : <Download size={20} />}</span>
        <span className={styles.text}>
          <span className={styles.title}>{installed ? 'Estás usando la app instalada' : 'Instalar Visitario'}</span>
          <span className={styles.help}>{installed ? 'Se abre desde tu pantalla de inicio y funciona sin señal.' : 'En tu pantalla de inicio, a pantalla completa y sin señal.'}</span>
        </span>
        <ChevronRight size={18} aria-hidden className={styles.chevron} />
      </button>
      <InstallSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
