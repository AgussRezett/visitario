import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, Pencil, Plus } from 'lucide-react'
import { formatDayMonth, todayInArgentina } from '@/domain/dates'
import { describeFormat } from '@/domain/import'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Skeleton } from '@/ui/Skeleton'
import { Switch } from '@/ui/Switch'
import { useWorkContext } from '@/features/workday/context'
import { adminCatalogsQuery, useCatalogAdmin, type AdminCatalogs, type CatalogKind } from '@/features/admin/api/catalogs'
import { FormatSheet } from './FormatSheet'
import { ItemSheet, type Editing } from './ItemSheet'
import { KINDS } from './kinds'
import styles from './CatalogsPage.module.scss'

/** Brands, display types, work metrics, channels, sellers and saved import formats (D02 / DM02). */
export function CatalogsPage() {
  const ctx = useWorkContext()
  const catalogs = useQuery({ ...adminCatalogsQuery(ctx?.companyId ?? ''), enabled: Boolean(ctx) })
  const { save } = useCatalogAdmin(ctx?.companyId ?? '')
  const [editing, setEditing] = useState<Editing>(null)
  const [format, setFormat] = useState<AdminCatalogs['formats'][number] | null>(null)
  if (!ctx) return null

  const section = (kind: CatalogKind) => {
    const k = KINDS[kind]
    const items = catalogs.data?.[kind] ?? []
    const active = items.filter((i) => i.active).length
    return (
      <section key={kind} className={styles.card} aria-label={k.title}>
        <div className={styles.head}>
          <span className={styles.titles}>
            <h2 className={styles.heading}>{k.title}</h2>
            <span className={styles.count}>{countText(active, items.length - active, k.fem)}</span>
          </span>
          <Button variant="secondary" size="sm" onClick={() => setEditing({ kind, item: null })} aria-label={`Agregar ${k.one}`}><Plus size={16} aria-hidden />Agregar</Button>
        </div>
        {k.intro ? <p className={styles.cardIntro}>{k.intro}</p> : null}
        {items.length ? (
          <ul className={styles.items}>
            {items.map((i) => (
              <li key={i.id} className={styles.item} data-inactive={!i.active || undefined}>
                <span className={styles.itemText}>
                  <span className={styles.name}>{kind === 'channel' && i.extra ? `${i.extra}. ${i.name}` : i.name}</span>
                  {k.extra && kind !== 'channel' ? <span className={styles.extra}>{i.extra || k.extra.empty}</span> : null}
                </span>
                <Switch checked={i.active} onChange={(on) => save.mutate({ kind, id: i.id, active: on })} className={styles.switch}>
                  <span className={styles.srOnly}>{i.name} activo</span>
                </Switch>
                <button type="button" className={styles.edit} onClick={() => setEditing({ kind, item: i })} aria-label={`Editar ${i.name}`}><Pencil size={16} aria-hidden /></button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>Todavía no hay {k.title.toLowerCase()}.</p>
        )}
      </section>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.pageTitles}>
          <span className={styles.eyebrow}>{ctx.companyName} · admin</span>
          <h1 className={styles.title}>Catálogos</h1>
        </div>
        <p className={styles.intro}>Lo que los activadores ven al registrar una visita. Los cambios les llegan la próxima vez que la app se actualiza con señal.</p>
      </header>
      {save.error ? <Banner tone="error">{save.error.message}</Banner> : null}

      {catalogs.isPending ? (
        <div className={styles.grid}>{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={220} />)}</div>
      ) : catalogs.error ? (
        <Banner tone="error">No pudimos cargar los catálogos. Revisá la conexión.</Banner>
      ) : (
        <div className={styles.grid}>
          {section('brand')}
          {section('display_type')}
          {section('work_metric')}
          {section('channel')}
          {section('seller')}
          <section className={styles.card} aria-label="Formatos de carga guardados">
            <div className={styles.head}><h2 className={styles.heading}>Formatos de carga guardados</h2></div>
            {catalogs.data.formats.length ? (
              <ul className={styles.items}>
                {catalogs.data.formats.map((f) => (
                  <li key={f.id} className={styles.item}>
                    <FileSpreadsheet size={18} aria-hidden className={styles.formatIcon} />
                    <span className={styles.itemText}>
                      <span className={styles.name}>{f.name}</span>
                      <span className={styles.extra}>{describeFormat(f.signature, f.mapping.columns)}</span>
                      {f.lastUsedAt ? <span className={styles.extra}>Usado el {formatDayMonth(todayInArgentina(new Date(f.lastUsedAt)))}</span> : null}
                    </span>
                    <button type="button" className={styles.edit} onClick={() => setFormat(f)} aria-label={`Editar ${f.name}`}><Pencil size={16} aria-hidden /></button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className={styles.empty}>Se crean al importar una planilla y elegir "Guardar como formato".</p>
          </section>
        </div>
      )}
      <ItemSheet editing={editing} companyId={ctx.companyId} sellers={catalogs.data?.seller} onClose={() => setEditing(null)} />
      <FormatSheet format={format} companyId={ctx.companyId} onClose={() => setFormat(null)} />
    </div>
  )
}

/** "3 activas · 1 inactiva", with the catalog's gender. */
function countText(active: number, inactive: number, fem?: boolean) {
  const word = (n: number, base: string) => `${n} ${base}${fem ? 'a' : 'o'}${n === 1 ? '' : 's'}`
  return [word(active, 'activ'), inactive ? word(inactive, 'inactiv') : null].filter(Boolean).join(' · ')
}
