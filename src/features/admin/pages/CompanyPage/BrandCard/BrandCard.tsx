import { useEffect, useRef, useState } from 'react'
import { Check, ImageUp, Palette, RotateCcw, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { BRAND_SUGGESTIONS, brandTokens, isAdjusted, normalizeHex } from '@/domain/brand'
import { applyBrand } from '@/lib/brand-style'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { CompanyLogo } from '@/features/shell/components/CompanyLogo'
import { useBrand } from '@/features/admin/api/brand'
import type { CompanySettings } from '@/features/admin/api/company'
import styles from './BrandCard.module.scss'

const VISITARIO = 'Visitario'

/**
 * The company's look: its logo and its color. While choosing, the whole app shows the
 * color (a live preview); leaving without saving puts the saved one back.
 */
export function BrandCard({ company: c }: { company: CompanySettings }) {
  const { color, upload, removeLogo } = useBrand(c.id, c.logoPath)
  const [draft, setDraft] = useState<string | null>(c.brandColor)
  const [typed, setTyped] = useState(c.brandColor ?? '')
  const file = useRef<HTMLInputElement>(null)
  const saved = useRef(c.brandColor)
  saved.current = c.brandColor
  useEffect(() => {
    setDraft(c.brandColor)
    setTyped(c.brandColor ?? '')
  }, [c.brandColor])
  // Live preview over the whole app; back to the saved color when leaving.
  useEffect(() => applyBrand(draft), [draft])
  useEffect(() => () => applyBrand(saved.current), [])

  const pick = (hex: string | null) => {
    setDraft(hex)
    setTyped(hex ?? '')
  }
  const typedHex = normalizeHex(typed)
  const changed = draft !== c.brandColor
  // A color of their own, not one of the suggestions
  const own = draft !== null && !BRAND_SUGGESTIONS.includes(draft)
  const error = color.error ?? upload.error ?? removeLogo.error

  return (
    <section className={styles.card} aria-label="Marca">
      <h2 className={styles.heading}>Marca</h2>
      <p className={styles.help}>El logo y el color de {c.name} se ven en Visitario para todas las personas de la empresa. Los colores de estado (aprobada, no autorizada, en curso) no cambian.</p>

      <div className={styles.block}>
        <span className={styles.label}>Logo</span>
        <div className={styles.logoRow}>
          <div className={styles.logoBox}>
            {c.logoPath ? <CompanyLogo path={c.logoPath} name={`Logo de ${c.name}`} height={40} /> : <span className={styles.empty}>Sin logo</span>}
          </div>
          <div className={styles.logoActions}>
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className={styles.file} aria-label="Elegir el logo"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = '' }} />
            <Button variant="secondary" size="md" loading={upload.isPending} onClick={() => file.current?.click()}><ImageUp size={18} aria-hidden />{c.logoPath ? 'Cambiar logo' : 'Subir logo'}</Button>
            {c.logoPath ? <Button variant="ghost" size="md" loading={removeLogo.isPending} onClick={() => removeLogo.mutate()}><Trash2 size={18} aria-hidden />Quitar</Button> : null}
          </div>
        </div>
        <p className={styles.help}>PNG, JPG o SVG, mejor con fondo transparente y horizontal.</p>
      </div>

      <div className={styles.block}>
        <span className={styles.label} id="brand-color">Color</span>
        <div className={styles.swatches} role="radiogroup" aria-labelledby="brand-color">
          <button type="button" role="radio" aria-checked={draft === null} className={clsx(styles.swatch, styles.visitario)} onClick={() => pick(null)} aria-label="El de Visitario">
            {draft === null ? <Check size={18} aria-hidden /> : null}
          </button>
          {BRAND_SUGGESTIONS.map((hex) => (
            <button key={hex} type="button" role="radio" aria-checked={draft === hex} className={styles.swatch} style={{ background: hex }} onClick={() => pick(hex)} aria-label={hex}>
              {draft === hex ? <Check size={18} aria-hidden /> : null}
            </button>
          ))}
          <label className={clsx(styles.swatch, styles.custom)} title="Otro color" data-on={own || undefined} style={own && draft ? { background: draft, color: brandTokens(draft, 'light').actionInk } : undefined}>
            {own ? <Check size={18} aria-hidden /> : <Palette size={20} aria-hidden />}
            <input type="color" value={draft ?? '#173b30'} onChange={(e) => pick(e.target.value)} aria-label="Otro color" />
          </label>
        </div>
        <Field label="Código del color" value={typed} placeholder={VISITARIO} maxLength={7}
          onChange={(e) => { setTyped(e.target.value); const hex = normalizeHex(e.target.value); if (hex) setDraft(hex) }}
          error={typed && !typedHex ? 'Escribilo como #1f4e8c' : undefined}
          help="Mientras elegís, toda la app se ve con ese color." />
        {draft && isAdjusted(draft) ? <Banner tone="info">Oscurecimos un poco el tono de los botones para que el texto se lea bien.</Banner> : null}
        <div className={styles.preview} aria-label="Así se ve">
          <Button size="md" tabIndex={-1}>Botón principal</Button>
          <span className={styles.selected}>Elegido</span>
        </div>
        <div className={styles.actions}>
          <Button size="md" disabled={!changed} loading={color.isPending} onClick={() => color.mutate(draft)}>Guardar color</Button>
          {changed ? <Button variant="ghost" size="md" onClick={() => pick(c.brandColor)}>Descartar</Button> : null}
          {!changed && c.brandColor ? <Button variant="ghost" size="md" loading={color.isPending} onClick={() => color.mutate(null)}><RotateCcw size={18} aria-hidden />Volver al estilo Visitario</Button> : null}
        </div>
      </div>
      {error ? <Banner tone="error">{error.message}</Banner> : null}
    </section>
  )
}
