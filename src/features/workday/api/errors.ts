/** Spanish message for database errors the person can act on. */
export function workdayErrorMessage(error: { message?: string; code?: string } | null | undefined) {
  const m = error?.message ?? ''
  if (m.includes('preparing')) return 'Tu supervisor está armando la jornada de ese día. Esperá a que la publique.'
  if (m.includes('storefront')) return 'Sacá la foto de la fachada antes de terminar la visita.'
  if (m.includes('consent')) return 'Marcá si el local te autorizó antes de terminar.'
  if (m.includes('approved visit is locked')) return 'Esta visita ya fue aprobada y no se puede cambiar.'
  if (m.includes('store_customer_number') || (error?.code === '23505' && m.includes('customer'))) return 'Ese número de cliente ya está en el directorio. Buscalo arriba.'
  if (m.includes('removes an assigned visit')) return 'Esta parada la asignó tu supervisor: solo él puede quitarla.'
  if (m.includes('store is archived')) return 'Ese comercio está archivado. Pedile a tu supervisor que lo restaure si hay que visitarlo.'
  if (m.includes('transition')) return 'Ese cambio de estado no está permitido.'
  return 'No pudimos guardar el cambio. Probá de nuevo.'
}
