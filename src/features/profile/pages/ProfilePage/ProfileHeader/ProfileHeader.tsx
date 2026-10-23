import { useState } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { ROLE_LABEL } from '@/domain/roles'
import { avatarUrl } from '@/lib/avatars'
import { initials } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import type { Me } from '@/features/auth/me'
import { PhotoPicker } from '@/features/workday/components/PhotoPicker'
import { useAvatar } from '@/features/profile/api'
import styles from './ProfileHeader.module.scss'

type Person = NonNullable<Me['person']>

/** The photo, the name and what I do; tapping the photo changes it. */
export function ProfileHeader({ me, person: p }: { me: Me; person: Person }) {
  const [open, setOpen] = useState(false)
  const { upload, remove } = useAvatar(me.userId, p.id, p.avatarPath)
  const busy = upload.isPending || remove.isPending
  const error = upload.error ?? remove.error
  const roles = [...new Set(me.memberships.flatMap((m) => m.roles))].map((r) => ROLE_LABEL[r]).join(' · ')
  const companies = me.memberships.filter((m) => !m.personal).map((m) => m.companyName).join(', ')
  const pick = (file: File) => {
    setOpen(false)
    upload.mutate(file)
  }

  return (
    <header className={styles.header}>
      <button type="button" className={styles.photo} onClick={() => setOpen(true)} disabled={busy} aria-label={p.avatarPath ? 'Cambiar mi foto de perfil' : 'Agregar una foto de perfil'}>
        <Avatar name={initials(p.firstName, p.lastName)} src={avatarUrl(p.avatarPath)} size={88} className={styles.avatar} />
        <span className={styles.badge} aria-hidden>{busy ? <span className={styles.spinner} /> : <Camera size={16} />}</span>
      </button>
      <div className={styles.identity}>
        <p className={styles.eyebrow}>Mi perfil</p>
        <h1 className={styles.name}>{p.firstName} {p.lastName}</h1>
        {roles ? <p className={styles.meta}>{roles}{companies ? ` · ${companies}` : ''}</p> : null}
      </div>
      {error ? <div className={styles.error}><Banner tone="error">{error.message}</Banner></div> : null}

      <Sheet open={open} onClose={() => setOpen(false)} title="Foto de perfil" subtitle="La ven tus compañeros y supervisores. Se guarda sin ubicación.">
        <div className={styles.options}>
          <PhotoPicker onPick={pick} source="camera" facing="user" className={styles.option}>
            <Camera size={20} aria-hidden />Sacar una foto
          </PhotoPicker>
          <PhotoPicker onPick={pick} source="gallery" className={styles.option}>
            <ImagePlus size={20} aria-hidden />Elegir de la galería
          </PhotoPicker>
          {p.avatarPath ? (
            <Button variant="ghost" size="lg" className={styles.remove} onClick={() => { setOpen(false); remove.mutate() }}>
              <Trash2 size={20} aria-hidden />Quitar la foto
            </Button>
          ) : null}
        </div>
      </Sheet>
    </header>
  )
}
