import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fitLogo } from '@/domain/brand'
import { refreshMe } from '@/features/auth/me'

export class BrandError extends Error {}

/** Any image as a PNG of a sensible size; drawing it on a canvas also drops its metadata. */
async function logoPng(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const { width, height } = fitLogo(img.naturalWidth || 720, img.naturalHeight || 240)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not available')
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not encode the logo')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** The company's color and logo, for its admins. Everyone sees the change on their next read. */
export function useBrand(companyId: string, currentLogo: string | null) {
  const qc = useQueryClient()
  const done = () => Promise.all([refreshMe(qc), qc.invalidateQueries({ queryKey: ['admin', 'company', companyId] })])
  const save = (patch: { brand_color?: string | null; logo_path?: string | null }) =>
    supabase.from('company').update(patch).eq('id', companyId).select('id')

  const color = useMutation({
    mutationFn: async (hex: string | null) => {
      const { data, error } = await save({ brand_color: hex })
      if (error || !data?.length) throw new BrandError('No pudimos guardar el color. Probá de nuevo.')
    },
    onSuccess: done,
  })
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 8 * 1024 * 1024) throw new BrandError('La imagen es muy pesada: elegí una de menos de 8 MB.')
      const png = await logoPng(file).catch(() => {
        throw new BrandError('No pudimos leer la imagen. Probá con un PNG, JPG o SVG.')
      })
      if (png.size > 1024 * 1024) throw new BrandError('El logo quedó muy pesado. Probá con una imagen más simple.')
      const path = `${companyId}/${Date.now()}.png`
      const { error } = await supabase.storage.from('logos').upload(path, png, { contentType: 'image/png', cacheControl: '31536000' })
      if (error) throw new BrandError('No pudimos subir el logo. Revisá la conexión y probá de nuevo.')
      const { data, error: saved } = await save({ logo_path: path })
      if (saved || !data?.length) {
        void supabase.storage.from('logos').remove([path])
        throw new BrandError('No pudimos guardar el logo. Probá de nuevo.')
      }
      // The previous one is no longer used by anyone.
      if (currentLogo) void supabase.storage.from('logos').remove([currentLogo])
    },
    onSuccess: done,
  })
  const removeLogo = useMutation({
    mutationFn: async () => {
      const { error } = await save({ logo_path: null })
      if (error) throw new BrandError('No pudimos quitar el logo. Probá de nuevo.')
      if (currentLogo) void supabase.storage.from('logos').remove([currentLogo])
    },
    onSuccess: done,
  })
  return { color, upload, removeLogo }
}
