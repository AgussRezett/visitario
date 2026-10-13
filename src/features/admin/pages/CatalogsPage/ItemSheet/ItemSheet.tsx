import { useEffect, useState } from 'react'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { Switch } from '@/ui/Switch'
import { useCatalogAdmin, type CatalogItem, type CatalogKind } from '@/features/admin/api/catalogs'
import { KINDS } from '../kinds'
import styles from './ItemSheet.module.scss'

export type Editing = { kind: CatalogKind; item: CatalogItem | null } | null

/** Add or edit a brand, display type or work metric. Items are deactivated, never deleted. */
export function ItemSheet({ editing, companyId, onClose }: { editing: Editing; companyId: string; onClose: () => void }) {
  const { save } = useCatalogAdmin(companyId)
  const [name, setName] = useState('')
  const [extra, setExtra] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    setName(editing?.item?.name ?? '')
    setExtra(editing?.item?.extra ?? '')
    setActive(editing?.item?.active ?? true)
    save.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new item starts a new form
  }, [editing])

  if (!editing) return null
  const k = KINDS[editing.kind]
  const submit = async () => {
    await save.mutateAsync({ kind: editing.kind, id: editing.item?.id, name: name.trim(), extra: k.extra ? extra.trim() || null : undefined, active })
    onClose()
  }

  return (
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
      <Field label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={editing.kind === 'brand' ? 60 : 40} autoFocus />
      {k.extra ? <Field label={k.extra.label} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={k.extra.placeholder} help={k.extra.help} maxLength={80} /> : null}
      {editing.item ? (
        <Switch checked={active} onChange={setActive}>
          Activo
          <span className={styles.help}>Inactivo: deja de aparecer en la ficha{editing.kind === 'work_metric' ? ' y en el informe' : ''}. Las visitas anteriores lo conservan.</span>
        </Switch>
      ) : null}
      {save.error ? <Banner tone="error">{save.error.message}</Banner> : null}
    </Sheet>
  )
}
