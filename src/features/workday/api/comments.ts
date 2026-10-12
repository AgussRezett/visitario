import { queryOptions } from '@tanstack/react-query'
import { supabase, type Enums } from '@/lib/supabase'
import { COMMENT_SELECT } from './selects'

/** A message in a visit's conversation between merchandiser and supervisor. */
export interface VisitComment {
  id: string
  visitId: string
  displayId: string | null
  authorId: string
  authorName: string
  kind: Enums<'comment_kind'>
  body: string
  createdAt: string
  /** Still on the phone, waiting for signal. */
  pending?: boolean
}

type CommentRow = {
  id: string
  visit_id: string
  display_id: string | null
  author_id: string
  kind: Enums<'comment_kind'>
  body: string
  created_at: string
  author: { first_name: string; last_name: string } | null
}

export const commentsQuery = (visitId: string) =>
  queryOptions({
    queryKey: ['workday', 'comments', visitId] as const,
    queryFn: async (): Promise<VisitComment[]> => {
      const { data, error } = await supabase.from('comment').select(COMMENT_SELECT).eq('visit_id', visitId).order('created_at')
      if (error) throw error
      return (data as unknown as CommentRow[]).map((c) => ({
        id: c.id,
        visitId: c.visit_id,
        displayId: c.display_id,
        authorId: c.author_id,
        authorName: c.author ? `${c.author.first_name} ${c.author.last_name}`.trim() : '',
        kind: c.kind,
        body: c.body,
        createdAt: c.created_at,
      }))
    },
  })

/** The visit's history: status changes and reviews, oldest first. */
export const visitEventsQuery = (visitId: string) =>
  queryOptions({
    queryKey: ['workday', 'events', visitId] as const,
    queryFn: async () => {
      const { data, error } = await supabase.from('visit_event').select('id, kind, from_value, to_value, occurred_at, actor_id').eq('visit_id', visitId).order('id')
      if (error) throw error
      return data
    },
  })
