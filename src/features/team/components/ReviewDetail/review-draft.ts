import { useState } from 'react'
import { isVisited } from '@/domain/visit'
import type { TeamVisit } from '@/features/team/api/queries'

/** The comment and the display it is about, shared by the detail and its buttons. */
export function useReviewDraft() {
  const [comment, setComment] = useState('')
  const [displayId, setDisplayId] = useState<string | null>(null)
  return { comment, setComment, displayId, setDisplayId, reset: () => (setComment(''), setDisplayId(null)) }
}
export type ReviewDraft = ReturnType<typeof useReviewDraft>

/** Why the supervisor cannot review this one, or null if they can. */
export function reviewBlock(v: TeamVisit, meId: string) {
  if (v.merchandiserId === meId) return 'Es tu propia visita: la revisa otra persona del equipo.'
  if (!isVisited(v.workStatus)) return 'Todavía no tiene resultado: se revisa cuando el activador la termine.'
  return null
}
