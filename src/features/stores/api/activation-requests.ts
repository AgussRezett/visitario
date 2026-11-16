import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Pedidos de activación: a seller asks to activate a client; the supervisor schedules it
// in a merchandiser's day (Asignar) or dismisses it with a reason.

export interface ActivationRequest {
  id: string
  storeId: string
  note: string | null
  status: 'open' | 'scheduled' | 'dismissed'
  createdAt: string
  by: string
  scheduledFor: string | null
  scheduledWith: string | null
  answer: string | null
  store: { name: string | null; address: string; area: string | null; customerNumber: string | null }
}

interface Row {
  id: string
  store_id: string
  note: string | null
  status: ActivationRequest['status']
  created_at: string
  scheduled_for: string | null
  answer: string | null
  asker: { first_name: string; last_name: string } | null
  assignee: { first_name: string } | null
  store: { name: string | null; address: string; area: string | null; customer_number: string | null } | null
}

const SELECT = `id, store_id, note, status, created_at, scheduled_for, answer,
  asker:person!activation_request_requested_by_fkey (first_name, last_name),
  assignee:person!activation_request_scheduled_merchandiser_fkey (first_name),
  store:store!activation_request_company_id_store_id_fkey (name, address, area, customer_number)`

const toRequest = (r: Row): ActivationRequest => ({
  id: r.id, storeId: r.store_id, note: r.note, status: r.status, createdAt: r.created_at,
  by: [r.asker?.first_name, r.asker?.last_name].filter(Boolean).join(' '),
  scheduledFor: r.scheduled_for, scheduledWith: r.assignee?.first_name ?? null, answer: r.answer,
  store: { name: r.store?.name ?? null, address: r.store?.address ?? '', area: r.store?.area ?? null, customerNumber: r.store?.customer_number ?? null },
})

async function list(filter: (q: ReturnType<typeof base>) => ReturnType<typeof base>) {
  const { data, error } = await filter(base()).limit(100)
  if (error) throw error
  return (data as unknown as Row[]).map(toRequest)
}
const base = () => supabase.from('activation_request').select(SELECT).is('deleted_at', null)

/** The open requests of the company, oldest first (the supervisor's, in Asignar). */
export const openRequestsQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['requests', 'open', companyId],
    enabled: Boolean(companyId),
    queryFn: () => list((q) => q.eq('company_id', companyId).eq('status', 'open').order('created_at')),
  })

/** A client's latest request (the seller's, on the client page). */
export const clientRequestQuery = (storeId: string) =>
  queryOptions({
    queryKey: ['requests', 'store', storeId],
    queryFn: async () => (await list((q) => q.eq('store_id', storeId).order('created_at', { ascending: false }).limit(1)))[0] ?? null,
  })

const fail = (what: string) => new Error(`No pudimos ${what}. Revisá la conexión y probá de nuevo.`)

export function useActivationRequests() {
  const qc = useQueryClient()
  const refresh = () =>
    Promise.all(['requests', 'team', 'workday', 'stores'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
  return {
    ask: useMutation({
      mutationFn: async (p: { storeId: string; note: string }) => {
        const { error } = await supabase.rpc('request_activation', { p_store: p.storeId, p_note: p.note.trim() || undefined })
        if (error) throw fail('mandar el pedido')
      },
      onSettled: refresh,
    }),
    cancel: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.rpc('cancel_activation_request', { p_request: id })
        if (error) throw fail('quitar el pedido')
      },
      onSettled: refresh,
    }),
    schedule: useMutation({
      mutationFn: async (p: { id: string; merchandiserId: string; date: string }) => {
        const { error } = await supabase.rpc('schedule_activation_request', { p_request: p.id, p_merchandiser: p.merchandiserId, p_date: p.date })
        if (error) throw fail('sumarlo a la jornada')
      },
      onSettled: refresh,
    }),
    dismiss: useMutation({
      mutationFn: async (p: { id: string; answer: string }) => {
        const { error } = await supabase.rpc('dismiss_activation_request', { p_request: p.id, p_answer: p.answer.trim() || undefined })
        if (error) throw fail('descartar el pedido')
      },
      onSettled: refresh,
    }),
  }
}
