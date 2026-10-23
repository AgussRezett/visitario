import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { AVATAR_SIDE, avatarPath, centerSquare } from '@/domain/profile'
import { refreshMe } from '@/features/auth/me'

/**
 * The photo as a square JPEG of 512 px. Drawing it on a canvas drops every EXIF field,
 * so no location (or camera data) ever leaves the phone.
 */
async function squarePhoto(file: Blob) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const { sx, sy, side } = centerSquare(bitmap.width, bitmap.height)
  const out = Math.min(AVATAR_SIDE, side)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  if (!blob) throw new Error('Could not encode the photo')
  return blob
}

export class ProfileError extends Error {}

export function useAvatar(userId: string, personId: string, current: string | null) {
  const qc = useQueryClient()
  const done = () => refreshMe(qc)
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const blob = await squarePhoto(file).catch(() => {
        throw new ProfileError('No pudimos leer la foto. Probá con otra.')
      })
      const path = avatarPath(userId)
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
      if (error) throw new ProfileError('No pudimos subir la foto. Revisá la conexión y probá de nuevo.')
      const saved = await supabase.from('person').update({ avatar_path: path }).eq('id', personId)
      if (saved.error) {
        void supabase.storage.from('avatars').remove([path])
        throw new ProfileError('No pudimos guardar la foto. Probá de nuevo.')
      }
      // The previous one is no longer used by anyone.
      if (current) void supabase.storage.from('avatars').remove([current])
    },
    onSuccess: done,
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('person').update({ avatar_path: null }).eq('id', personId)
      if (error) throw new ProfileError('No pudimos quitar la foto. Probá de nuevo.')
      if (current) void supabase.storage.from('avatars').remove([current])
    },
    onSuccess: done,
  })
  return { upload, remove }
}

export interface ProfileChange {
  firstName: string
  lastName: string
  phone: string | null
  birthDate: string | null
}

export function useSaveProfile(personId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: ProfileChange) => {
      const [names, priv] = await Promise.all([
        supabase.from('person').update({ first_name: v.firstName, last_name: v.lastName }).eq('id', personId),
        supabase.from('person_private').update({ phone: v.phone, birth_date: v.birthDate }).eq('person_id', personId),
      ])
      if (names.error || priv.error) throw new ProfileError('No pudimos guardar tus datos. Probá de nuevo.')
    },
    onSuccess: () => refreshMe(qc),
  })
}

/** Supabase sends a link to the new address; the email changes when it is opened. */
export function useChangeEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() }, { emailRedirectTo: `${window.location.origin}/profile` })
      if (!error) return
      if (/already|registered|exists/i.test(error.message)) throw new ProfileError('Ese email ya es de otra cuenta.')
      if (/rate|seconds|too many/i.test(error.message)) throw new ProfileError('Esperá un minuto antes de pedir otro enlace.')
      throw new ProfileError('No pudimos mandar el enlace. Probá de nuevo en un rato.')
    },
  })
}
