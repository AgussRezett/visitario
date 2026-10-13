import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { describeFormat } from '@/domain/import'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Field } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { useCatalogAdmin, type AdminCatalogs } from '@/features/admin/api/catalogs'
import styles from './FormatSheet.module.scss'

type Format = AdminCatalogs['formats'][number]

/** Rename a saved spreadsheet format, or forget it so the next import asks again. */
export function FormatSheet({ format, companyId, onClose }: { format: Format | null; companyId: string; onClose: () => void }) {
  const { saveFormat } = useCatalogAdmin(companyId)
  const { confirm, dialog } = useConfirm()
  const [name, setName] = useState('')
  useEffect(() => {
    setName(format?.name ?? '')
    saveFormat.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new format starts a new form
  }, [format])
  if (!format) return null

  const remove = async () => {
    if (!(await confirm({ title: `¿Olvidar "${format.name}"?`, description: 'La próxima planilla con esas columnas te va a preguntar qué hay en cada una.', confirmLabel: 'Olvidar formato', tone: 'danger' }))) return
    await saveFormat.mutateAsync({ id: format.id, remove: true })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={format.name}
      subtitle="Formato de carga"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} className={styles.cancel}>Cancelar</Button>
          <Button size="md" disabled={!name.trim() || name.trim() === format.name} loading={saveFormat.isPending}
            onClick={async () => { await saveFormat.mutateAsync({ id: format.id, name: name.trim() }); onClose() }}>Guardar</Button>
        </>
      }
    >
      <Field label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      <p className={styles.columns}>{describeFormat(format.signature, format.mapping.columns)}</p>
      {saveFormat.error ? <Banner tone="error">{saveFormat.error.message}</Banner> : null}
      <Button variant="ghost" size="sm" onClick={remove} className={styles.remove}><Trash2 size={16} aria-hidden />Olvidar formato</Button>
      {dialog}
    </Sheet>
  )
}
