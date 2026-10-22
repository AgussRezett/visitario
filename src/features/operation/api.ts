import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toOperations, type Operation } from '@/domain/operations'

export const operationKeys = {
  all: ['operation'] as const,
  day: (companyId: string, date: string) => ['operation', 'day', companyId, date] as const,
  people: (companyId: string) => ['operation', 'people', companyId] as const,
}

/** A database refusal, in Spanish. */
export class OperationError extends Error {}
export function operationError(m: string) {
  if (m.includes('already in an operativo')) return 'Alguien ya está en otro operativo ese día.'
  if (m.includes('at least two')) return 'Elegí al menos un compañero.'
  if (m.includes('up to 12')) return 'Un operativo es de hasta 12 activadores.'
  if (m.includes('not an active merchandiser')) return 'Solo activadores activos de la empresa se suman.'
  if (m.includes('host ends')) return 'Quien armó el operativo lo termina; no puede salir.'
  if (m.includes('ended') || m.includes('not found')) return 'Ese operativo ya terminó.'
  if (m.includes('pending stops')) return 'Solo tus locales pendientes de ese día se pueden sumar.'
  if (m.includes('Your supervisor is preparing')) return 'Tu supervisor está preparando ese día.'
  return 'No pudimos completar el cambio. Probá de nuevo.'
}
const fail = (error: { message: string }) => new OperationError(operationError(error.message))

/** The operativos of a day that I can see, with members and progress. */
export const dayOperationsQuery = (companyId: string, date: string) =>
  queryOptions({
    queryKey: operationKeys.day(companyId, date),
    queryFn: async (): Promise<Operation[]> => {
      const { data, error } = await supabase.rpc('day_operations', { p_company: companyId, p_date: date })
      if (error) throw error
      return toOperations(data)
    },
  })

export const useDayOperations = (companyId: string, date: string, enabled = true) =>
  useQuery({ ...dayOperationsQuery(companyId, date), enabled: enabled && Boolean(companyId) })

export interface Teammate {
  personId: string
  firstName: string
  lastName: string
}

/**
 * The company's active activadores, to pick who goes out together. Asked again each time
 * the picker opens: an admin may have just given someone the role or turned them off.
 */
export const teammatesQuery = (companyId: string) =>
  queryOptions({
    queryKey: operationKeys.people(companyId),
    staleTime: 0,
    queryFn: async (): Promise<Teammate[]> => {
      const { data, error } = await supabase
        .from('membership')
        .select('person_id, person:person!membership_person_id_fkey (first_name, last_name)')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .contains('roles', ['merchandiser'])
      if (error) throw error
      return (data ?? [])
        .map((m) => {
          const p = m.person as { first_name: string; last_name: string } | null
          return { personId: m.person_id, firstName: p?.first_name ?? '', lastName: p?.last_name ?? '' }
        })
        .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'es'))
    },
  })

export function useOperationActions(companyId: string) {
  const qc = useQueryClient()
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: operationKeys.all }), qc.invalidateQueries({ queryKey: ['workday'] }), qc.invalidateQueries({ queryKey: ['team'] })])
  const create = useMutation({
    mutationFn: async (input: { date: string; members: string[]; host?: string; name?: string }) => {
      const { data, error } = await supabase.rpc('create_operation', {
        p_company: companyId, p_date: input.date, p_members: input.members, p_host: input.host, p_name: input.name?.trim() || undefined,
      })
      if (error) throw fail(error)
      return data
    },
    onSettled: refresh,
  })
  const addMember = useMutation({
    mutationFn: async (input: { operationId: string; personId: string }) => {
      const { error } = await supabase.rpc('add_operation_member', { p_operation: input.operationId, p_person: input.personId })
      if (error) throw fail(error)
    },
    onSettled: refresh,
  })
  const leave = useMutation({
    mutationFn: async (operationId: string) => {
      const { error } = await supabase.rpc('leave_operation', { p_operation: operationId })
      if (error) throw fail(error)
    },
    onSettled: refresh,
  })
  const end = useMutation({
    mutationFn: async (operationId: string) => {
      const { error } = await supabase.rpc('end_operation', { p_operation: operationId })
      if (error) throw fail(error)
    },
    onSettled: refresh,
  })
  const bring = useMutation({
    mutationFn: async (input: { operationId: string; visitIds: string[] }) => {
      const { data, error } = await supabase.rpc('bring_to_operation', { p_operation: input.operationId, p_visits: input.visitIds })
      if (error) throw fail(error)
      return data
    },
    onSettled: refresh,
  })
  return { create, addMember, leave, end, bring }
}
