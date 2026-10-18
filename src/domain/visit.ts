import type { Enums } from '@/lib/supabase'

export type WorkStatus = Enums<'work_status'>
export type Consent = Enums<'consent_kind'>
export type ReviewStatus = Enums<'review_status'>

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  done: 'Terminada',
  refused: 'No autorizada',
  closed: 'Cerrado',
}

export const CONSENT_LABEL: Record<Consent, string> = {
  yes: 'Sí',
  with_objection: 'Con oposición',
  refused: 'No autorizó',
  closed: 'Cerrado',
}

/** Same transitions the database allows (private.work_transition_is_valid). */
const TRANSITIONS: Record<WorkStatus, readonly WorkStatus[]> = {
  pending: ['in_progress', 'closed', 'refused'],
  in_progress: ['done', 'refused', 'closed', 'pending'],
  closed: ['in_progress'],
  done: ['in_progress'],
  refused: [],
}

export function canTransition(from: WorkStatus, to: WorkStatus) {
  return from === to || TRANSITIONS[from].includes(to)
}

/**
 * Locked for the merchandiser: approved by a supervisor. A visit approved on its own
 * (the merchandiser is not reviewed) stays theirs to fix. Same rule as the database.
 */
export const isLocked = (v: { reviewStatus: ReviewStatus; autoApproved?: boolean }) => v.reviewStatus === 'approved' && !v.autoApproved

/**
 * Whether the merchandiser can take a stop off the day: the ones they added or resumed,
 * never one the supervisor assigned or a locked visit (same rule as the database).
 */
export function canRemoveVisit(v: { addedByMe: boolean; resumedFrom: string | null; reviewStatus: ReviewStatus; autoApproved?: boolean }) {
  return !isLocked(v) && (v.addedByMe || v.resumedFrom !== null)
}

/** Every visit with a result counts as visited: done, not authorized or closed. */
export function isVisited(status: WorkStatus) {
  return status === 'done' || status === 'refused' || status === 'closed'
}

/** The work status a visit ends in, from the store's answer. */
export function finishStatus(consent: Consent): WorkStatus {
  if (consent === 'refused') return 'refused'
  if (consent === 'closed') return 'closed'
  return 'done'
}

/** The store let the merchandiser work (displays and work are enabled). */
export function canWork(consent: Consent | null) {
  return consent === 'yes' || consent === 'with_objection'
}

export interface FinishCheck {
  workStatus: WorkStatus
  consent: Consent | null
  hasStorefront: boolean
  displays: { arranged: boolean }[]
}

export type FinishBlocker = 'storefront' | 'consent'

/** What is missing to end the visit, and which displays stay to resume. */
export function finishCheck(v: FinishCheck) {
  const blockers: FinishBlocker[] = []
  if (!v.hasStorefront) blockers.push('storefront')
  if (!v.consent) blockers.push('consent')
  const unarranged = canWork(v.consent) ? v.displays.filter((d) => !d.arranged).length : 0
  const target = v.consent ? finishStatus(v.consent) : null
  return { ok: blockers.length === 0 && target !== null && canTransition(v.workStatus, target), blockers, unarranged, target }
}

export interface ProgressInput {
  workStatus: WorkStatus
  reviewStatus: ReviewStatus
}

/** Counts for the workday progress card. */
export function workdayProgress(visits: ProgressInput[]) {
  const count = (f: (v: ProgressInput) => boolean) => visits.filter(f).length
  const total = visits.length
  const visited = count((v) => isVisited(v.workStatus))
  return {
    total,
    visited,
    percent: total ? Math.round((visited / total) * 100) : 0,
    approved: count((v) => v.reviewStatus === 'approved'),
    done: count((v) => v.workStatus === 'done' && v.reviewStatus !== 'approved'),
    closed: count((v) => v.workStatus === 'closed'),
    refused: count((v) => v.workStatus === 'refused'),
    needsFix: count((v) => v.reviewStatus === 'needs_fix'),
    inProgress: count((v) => v.workStatus === 'in_progress'),
  }
}
