import { queryOptions, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { avatarUrl } from '@/lib/avatars'

/**
 * Who has a profile photo, among the people I share a company with (the same rule that
 * lets me see their names). One small read for every screen that shows people; a new
 * photo reaches the others within minutes.
 */
export const peoplePhotosQuery = queryOptions({
  queryKey: ['people', 'photos'] as const,
  staleTime: 10 * 60_000,
  queryFn: async (): Promise<Record<string, string>> => {
    const { data, error } = await supabase.from('person').select('id, avatar_path').not('avatar_path', 'is', null)
    if (error) throw error
    return Object.fromEntries((data ?? []).flatMap((p) => (p.avatar_path ? [[p.id, p.avatar_path]] : [])))
  },
})

/** The photo of a person, when they have one. */
export function usePersonPhoto(personId: string | null | undefined) {
  const { data } = useQuery(peoplePhotosQuery)
  return personId ? avatarUrl(data?.[personId]) : null
}
