import { useMemo } from 'react'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSync } from '@/features/sync/outbox'

// Novedades: what an activador reports from a store (it needs an order, no stock...) for
// the supervisor, who marks them resolved.

export interface StoreIssue {
  id: string
  visitId: string
  typeId: number
  note: string | null
  status: 'open' | 'resolved'
  createdAt: string
  createdBy: string
  by: string
  resolvedAt: string | null
  resolvedBy: string | null
  resolution: string | null
  store: { id: string; name: string | null; address: string; area: string | null; customerNumber: string | null; channelId: number | null; sellerId: number | null }
  /** Still on the phone, on its way. */
  pending?: boolean
}

interface Row {
  id: string
  visit_id: string
  type_id: number
  note: string | null
  status: 'open' | 'resolved'
  created_at: string
  created_by: string
  resolved_at: string | null
  resolution: string | null
  creator: { first_name: string; last_name: string } | null
  resolver: { first_name: string } | null
  store: { id: string; name: string | null; address: string; area: string | null; customer_number: string | null; channel_id: number | null; seller_id: number | null } | null
}

const SELECT = `id, visit_id, type_id, note, status, created_at, created_by, resolved_at, resolution,
  creator:person!store_issue_created_by_fkey (first_name, last_name),
  resolver:person!store_issue_resolved_by_fkey (first_name),
  store:store!store_issue_company_id_store_id_fkey (id, name, address, area, customer_number, channel_id, seller_id)`

const toIssue = (r: Row): StoreIssue => ({
  id: r.id, visitId: r.visit_id, typeId: r.type_id, note: r.note, status: r.status, createdAt: r.created_at, createdBy: r.created_by,
  by: [r.creator?.first_name, r.creator?.last_name].filter(Boolean).join(' '),
  resolvedAt: r.resolved_at, resolvedBy: r.resolver?.first_name ?? null, resolution: r.resolution,
  store: {
    id: r.store?.id ?? '', name: r.store?.name ?? null, address: r.store?.address ?? '', area: r.store?.area ?? null,
    customerNumber: r.store?.customer_number ?? null, channelId: r.store?.channel_id ?? null, sellerId: r.store?.seller_id ?? null,
  },
})

const LIMIT = 200

async function list(filter: (q: ReturnType<typeof base>) => ReturnType<typeof base>) {
  const { data, error } = await filter(base()).order('created_at', { ascending: false }).limit(LIMIT)
  if (error) throw error
  return (data as unknown as Row[]).map(toIssue)
}
const base = () => supabase.from('store_issue').select(SELECT).is('deleted_at', null)

export const issueKeys = {
  inbox: (companyId: string, status: 'open' | 'resolved') => ['issues', 'inbox', companyId, status] as const,
  /** Under 'workday': refreshed with the day after the phone sends its changes. */
  visit: (visitId: string) => ['workday', 'issues', visitId] as const,
  store: (storeId: string) => ['issues', 'store', storeId] as const,
}

/** The supervisor's inbox: open ones (oldest waiting longest still first by date), or the resolved. */
export const issuesInboxQuery = (companyId: string, status: 'open' | 'resolved') =>
  queryOptions({
    queryKey: issueKeys.inbox(companyId, status),
    enabled: Boolean(companyId),
    queryFn: () => list((q) => q.eq('company_id', companyId).eq('status', status)),
  })

export const storeIssuesQuery = (storeId: string) =>
  queryOptions({ queryKey: issueKeys.store(storeId), enabled: Boolean(storeId), queryFn: () => list((q) => q.eq('store_id', storeId)) })

/** A visit's novedades, with the ones still on the phone (just reported, maybe without signal). */
export function useVisitIssues(visitId: string, me: { id: string; name: string }) {
  const issues = useQuery({ queryKey: issueKeys.visit(visitId), queryFn: () => list((q) => q.eq('visit_id', visitId)) })
  const { rows } = useSync()
  const data = useMemo(() => {
    const removed = new Set(rows.flatMap((r) => (r.op.kind === 'issue.remove' && r.op.visitId === visitId ? [r.op.issueId] : [])))
    const server = (issues.data ?? []).filter((i) => !removed.has(i.id))
    const pending: StoreIssue[] = rows.flatMap((r) => {
      const op = r.op
      if (op.kind !== 'issue.add' || op.visitId !== visitId || r.state === 'failed' || server.some((i) => i.id === op.issueId)) return []
      return [{ id: op.issueId, visitId, typeId: op.typeId, note: op.note, status: 'open' as const, createdAt: r.createdAt, createdBy: me.id, by: me.name,
        resolvedAt: null, resolvedBy: null, resolution: null, store: { id: op.storeId, name: null, address: '', area: null, customerNumber: null, channelId: null, sellerId: null }, pending: !r.sent }]
    })
    return [...pending, ...server]
  }, [issues.data, rows, visitId, me.id, me.name])
  return { ...issues, data }
}

/** Resolved (with an optional note), or open again. */
export function useResolveIssue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id: string; resolved: boolean; note?: string }) => {
      const { error } = await supabase.rpc('resolve_store_issue', { p_issue: p.id, p_resolved: p.resolved, p_note: p.note?.trim() || undefined })
      if (error) throw new Error('No pudimos guardar el cambio. Revisá la conexión y probá de nuevo.')
    },
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['issues'] }), qc.invalidateQueries({ queryKey: ['workday', 'issues'] }), qc.invalidateQueries({ queryKey: ['team', 'badges'] })]),
  })
}
