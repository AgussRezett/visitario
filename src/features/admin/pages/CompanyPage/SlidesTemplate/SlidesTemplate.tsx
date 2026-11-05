import { useRef } from 'react'
import { ImageUp } from 'lucide-react'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useSlideBackground, type CompanySettings } from '@/features/admin/api/company'
import { slideAssetUrl } from '@/features/team/api/slides'
import styles from './SlidesTemplate.module.scss'

const PARTS = [
  { which: 'cover', label: 'Portada', help: 'Con la marca y los logos. Visitario escribe abajo el total de activaciones.' },
  { which: 'page', label: 'Diapositiva', help: 'En blanco, con los logos arriba a la derecha. Visitario pone la dirección, la fecha y las fotos.' },
] as const

/**
 * The company's look for the photo presentation (Reportes → Presentación): a cover and a
 * slide background, 16:9 images. Visitario writes the texts and the photos on top.
 */
export function SlidesTemplate({ company: c, cardClass, headingClass, helpClass }: { company: CompanySettings; cardClass?: string; headingClass?: string; helpClass?: string }) {
  const upload = useSlideBackground(c.id)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const pathOf = (which: 'cover' | 'page') => (which === 'cover' ? c.slidesCoverPath : c.slidesPagePath)

  return (
    <section className={cardClass} aria-label="Presentación de fotos">
      <h2 className={headingClass}>Presentación de fotos</h2>
      <p className={helpClass}>Los fondos de la presentación con los después de cada visita. Imágenes horizontales 16:9 (por ejemplo 1920 × 1080), PNG o JPG.</p>
      <div className={styles.parts}>
        {PARTS.map((p) => {
          const url = slideAssetUrl(pathOf(p.which))
          return (
            <div key={p.which} className={styles.part}>
              <span className={styles.label}>{p.label}</span>
              {url ? <img className={styles.preview} src={url} alt={`${p.label} de la presentación`} /> : <span className={styles.empty}>Sin imagen: fondo blanco</span>}
              <span className={helpClass}>{p.help}</span>
              <input ref={(el) => { inputs.current[p.which] = el }} type="file" accept="image/png,image/jpeg" hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) upload.mutate({ which: p.which, file, current: pathOf(p.which) })
                }} />
              <Button variant="secondary" size="md" loading={upload.isPending && upload.variables?.which === p.which} disabled={upload.isPending}
                onClick={() => inputs.current[p.which]?.click()}>
                <ImageUp size={18} aria-hidden />{url ? 'Cambiar imagen' : 'Subir imagen'}
              </Button>
            </div>
          )
        })}
      </div>
      {upload.error ? <Banner tone="error">{upload.error.message}</Banner> : null}
    </section>
  )
}
