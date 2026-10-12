import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Logo } from '@/ui/Logo'
import styles from './AuthLayout.module.scss'

const points = [
  'Activadores: la jornada en el celular, sin señal también.',
  'Supervisores: asignar, revisar y aprobar en un solo lugar.',
  'Administradores: equipos, catálogos y plan de la empresa.',
]

/** Login and sign-up frame: single column on phones, split panel on desktop (wireframes A01 / AD01). */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.layout}>
      <aside className={styles.brand}>
        <Logo size="lg" onDark />
        <div className={styles.pitch}>
          <p className={styles.headline}>Tu jornada de campo, del recorrido al OK.</p>
          <ul className={styles.points}>
            {points.map((p) => (
              <li key={p} className={styles.point}>
                <span className={styles.check}>
                  <Check size={16} strokeWidth={3} aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className={styles.footnote}>Una sola cuenta para el celular y la computadora.</p>
      </aside>
      <main className={styles.main}>
        <div className={styles.column}>
          <div className={styles.mobileLogo}>
            <Logo size="lg" />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
