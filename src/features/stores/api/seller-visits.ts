import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Range } from '@/domain/report-period'
import type { OrderLine, SellerOutcome } from '@/domain/seller-visits'
import { supabase } from '@/lib/supabase'
import { uuidv7 } from '@/lib/id'

// The seller's own visits to their clients, and how each seller's portfolio is covered.

export interface SellerVisit {
  id: string
  visitedAt: string
  outcome: SellerOutcome
  reason: string | null
  note: string | null
  lines: OrderLine[]
}

export interface SellerCoverage {
  sellerId: number
  name: string
  hasUser: boolean
  target: number | null
  clients: number
  visitedClients: number
  visits: number
  orders: number
  noOrders: number
  closed: number
  activatedClients: number
}

const asLines = (v: unknown): OrderLine[] =>
  Array.isArray(v) ? v.flatMap((l) => (l && typeof l === 'object' && 'item' in l && 'qty' in l ? [{ qty: Number(l.qty) || 1, item: String(l.item) }] : [])) : []

/** A client's latest visits by its seller (the database shows a seller only their own). */
export const sellerVisitsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ['stores', 'seller-visits', storeId],
    queryFn: async (): Promise<SellerVisit[]> => {
      const { data, error } = await supabase.from('seller_visit').select('id, visited_at, outcome, reason, note, order_lines')
        .eq('store_id', storeId).is('deleted_at', null).order('visited_at', { ascending: false }).limit(10)
      if (error) throw error
      return (data ?? []).map((r) => ({ id: r.id, visitedAt: r.visited_at, outcome: r.outcome, reason: r.reason, note: r.note, lines: asLines(r.order_lines) }))
    },
  })

/** Each seller's coverage in a period: everyone's for a supervisor, their own for a seller. */
export const coverageQuery = (companyId: string, range: Range) =>
  queryOptions({
    queryKey: ['stores', 'coverage', companyId, range.from, range.to],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<SellerCoverage[]> => {
      const { data, error } = await supabase.rpc('seller_coverage', { p_company: companyId, p_from: range.from, p_to: range.to })
      if (error) throw error
      return (data ?? []).map((r) => ({
        sellerId: r.seller_id, name: r.name, hasUser: r.has_user, target: r.monthly_target, clients: r.clients, visitedClients: r.visited_clients,
        visits: r.visits, orders: r.orders, noOrders: r.no_orders, closed: r.closed, activatedClients: r.activated_clients,
      }))
    },
  })

const fail = (what: string) => new Error(`No pudimos ${what}. Revisá la conexión y probá de nuevo: no se pierde nada.`)

export interface NewSellerVisit {
  storeId: string
  outcome: SellerOutcome
  reason: string | null
  note: string
  lines: OrderLine[]
}

export function useSellerVisits() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['stores'] })
  return {
    /** The id is made here, so trying again after a lost signal never records it twice. */
    record: useMutation({
      mutationFn: async (v: NewSellerVisit & { id: string }) => {
        const { error } = await supabase.rpc('record_seller_visit', {
          p_id: v.id, p_store: v.storeId, p_outcome: v.outcome, p_reason: v.reason ?? undefined, p_note: v.note.trim() || undefined,
          p_lines: v.lines.map((l) => ({ qty: l.qty, item: l.item })),
        })
        if (error) throw fail('guardar la visita')
      },
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.rpc('remove_seller_visit', { p_id: id })
        if (error) throw fail('quitar la visita')
      },
      onSettled: refresh,
    }),
    setTarget: useMutation({
      mutationFn: async (p: { sellerId: number; target: number | null }) => {
        const { error } = await supabase.rpc('set_seller_target', { p_seller: p.sellerId, p_target: p.target ?? 0 })
        if (error) throw fail('guardar el objetivo')
      },
      onSettled: refresh,
    }),
  }
}

export const newVisitId = () => uuidv7()
