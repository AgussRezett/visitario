import { useEffect, useState } from 'react'
import { Merge } from 'lucide-react'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Field } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { Sheet } from '@/ui/Sheet'
import { Switch } from '@/ui/Switch'
import { useCatalogAdmin, type CatalogItem, type CatalogKind } from '@/features/admin/api/catalogs'
import { KINDS } from '../kinds'
import styles from './ItemSheet.module.scss'

export type Editing = { kind: CatalogKind; item: CatalogItem | null } | null

/** Add or edit a catalog item. Items are deactivated, never deleted; a repeated seller is merged. */
export function ItemSheet({ editing, companyId, sellers = [], onClose }: { editing: Editing; companyId: string; sellers?: CatalogItem[]; onClose: () => void }) {
  const { save, mergeSellers } = useCatalogAdmin(companyId)
  const { confirm, dialog } = useConfirm()
  const [into, setInto] = useState('')
  const [name, setName] = useState('')
  const [extra, setExtra] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    setName(editing?.item?.name ?? '')
    setExtra(editing?.item?.extra ?? '')
    setActive(editing?.item?.active ?? true)
    setInto('')
    save.reset()
    mergeSellers.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new item starts a new form
  }, [editing])

  if (!editing) return null
  const k = KINDS[editing.kind]
  const submit = async () => {
    const editable = k.extra && !k.extra.readOnly
    await save.mutateAsync({ kind: editing.kind, id: editing.item?.id, name: name.trim(), extra: editable ? extra.trim() || null : undefined, active })
    onClose()
  }

  // The same person loaded twice: this one's stores go to the one picked, and this one goes inactive.
  const current = editing.kind === 'seller' ? editing.item : null
  const others = current ? sellers.filter((s) => s.id !== current.id && !(current.extra && s.extra)) : []
  const target = others.find((s) => String(s.id) === into)
  const merge = async () => {
    if (!current || !target) return
    const ok = await confirm({
      title: `¿Unir «${current.name}» con «${target.name}»?`,
      description: `Los comercios de ${current.name} pasan a ${target.name}${current.extra ? ', junto con su usuario de Visitario' : ''}, y ${current.name} queda inactivo. Hacelo solo si son la misma persona.`,
      confirmLabel: 'Unir',
    })
    if (!ok) return
    await mergeSellers.mutateAsync({ keep: target.id, drop: current.id })
    onClose()
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={editing.item ? `Editar ${editing.item.name}` : k.fresh}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={onClose} className={styles.cancel}>Cancelar</Button>
            <Button size="md" disabled={!name.trim()} loading={save.isPending} onClick={submit}>{editing.item ? 'Guardar' : 'Agregar'}</Button>
          </>
        }
      >
        <Field label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={k.max ?? (editing.kind === 'brand' ? 60 : 40)} autoFocus />
        {k.extra && !k.extra.readOnly ? (
          <Field label={k.extra.label} value={extra} onChange={(e) => setExtra(k.extra?.numeric ? e.target.value.replace(/\D/g, '').slice(0, 3) : e.target.value)}
            inputMode={k.extra.numeric ? 'numeric' : undefined} placeholder={k.extra.placeholder} help={k.extra.help} maxLength={k.extra.numeric ? 3 : 80} />
        ) : null}
        {editing.kind === 'seller' ? (
          <p className={styles.help}>{editing.item?.extra ? 'Tiene usuario en Visitario: ve sus clientes y las activaciones.' : 'Sin usuario todavía. Al invitarlo desde Usuarios con el rol Vendedor, elegí este nombre en «¿Ya está cargado como vendedor?»: queda vinculado con sus comercios.'}</p>
        ) : null}
        {editing.item ? (
          <Switch checked={active} onChange={setActive}>
            Activo
            <span className={styles.help}>{editing.kind === 'channel' || editing.kind === 'seller'
              ? 'Inactivo: no se ofrece para comercios nuevos. Los comercios que lo tienen lo conservan.'
              : `Inactivo: deja de aparecer en la ficha${editing.kind === 'work_metric' ? ' y en el informe' : ''}. Las visitas anteriores lo conservan.`}</span>
          </Switch>
        ) : null}
        {current && others.length ? (
          <div className={styles.merge}>
            <span className={styles.mergeTitle}>¿Está repetido?</span>
            <p className={styles.help}>Si {current.name} es la misma persona que otro vendedor (por ejemplo, uno cargado con el nombre completo al crear su usuario), unilos: sus comercios pasan al que elijas.</p>
            <div className={styles.mergeRow}>
              <Select label="Unir con" value={into} onChange={(e) => setInto(e.target.value)}
                options={[{ value: '', label: 'Elegí el vendedor' }, ...others.map((s) => ({ value: String(s.id), label: `${s.name}${s.extra ? ' · con usuario' : ''}${s.active ? '' : ' · inactivo'}` }))]} />
              <Button variant="secondary" size="md" disabled={!target} loading={mergeSellers.isPending} onClick={() => void merge().catch(() => null)}><Merge size={18} aria-hidden />Unir</Button>
            </div>
            {mergeSellers.error ? <Banner tone="error">{mergeSellers.error.message}</Banner> : null}
          </div>
        ) : null}
        {save.error ? <Banner tone="error">{save.error.message}</Banner> : null}
      </Sheet>
      {dialog}
    </>
  )
}
