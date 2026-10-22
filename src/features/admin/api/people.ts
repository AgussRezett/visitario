import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/domain/roles'
import type { CompanyPerson, MembershipStatus, Team } from '@/domain/people'
import { operationKeys } from '@/features/operation/api'

export const adminKeys = {
  people: (companyId: string) => ['admin', 'people', companyId] as const,
  teams: (companyId: string) => ['admin', 'teams', companyId] as const,
}

export const peopleQuery = (companyId: string) =>
  queryOptions({
    queryKey: adminKeys.people(companyId),
    queryFn: async (): Promise<CompanyPerson[]> => {
      const [{ data, error }, hours] = await Promise.all([
        supabase.rpc('company_people', { p_company: companyId }),
        supabase.from('membership').select('id, shift_start, shift_end, auto_approve').eq('company_id', companyId),
      ])
      if (error) throw error
      if (hours.error) throw hours.error
      const own = new Map(hours.data.filter((h) => h.shift_start).map((h) => [h.id, { start: (h.shift_start ?? '').slice(0, 5), end: (h.shift_end ?? '').slice(0, 5) }]))
      const auto = new Set(hours.data.filter((h) => h.auto_approve).map((h) => h.id))
      return (data ?? []).map((r) => ({
        membershipId: r.membership_id,
        personId: r.person_id,
        firstName: r.first_name,
        lastName: r.last_name,
        roles: r.roles,
        teamId: r.team_id,
        status: r.status,
        startsOn: r.starts_on,
        phoneLast4: r.phone_last4,
        lastActivityAt: r.last_activity_at,
        invitedAt: r.invited_at,
        shift: own.get(r.membership_id) ?? null,
        autoApprove: auto.has(r.membership_id),
      }))
    },
  })

export const teamsQuery = (companyId: string) =>
  queryOptions({
    queryKey: adminKeys.teams(companyId),
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase.from('team').select('id, name, areas').eq('company_id', companyId).order('name')
      if (error) throw error
      return data ?? []
    },
  })

/** Spanish messages for what the database refuses here. */
export function adminErrorMessage(m: string) {
  if (m.includes('at least one active admin')) return 'La empresa tiene que tener al menos un admin activo.'
  if (m.includes('invited person')) return 'Solo la persona invitada puede aceptar la invitación.'
  if (m.includes('team_company_id_name_key') || m.includes('duplicate key')) return 'Ya hay un equipo con ese nombre.'
  if (m.includes('Too many lookups')) return 'Hiciste muchas búsquedas por DNI en la última hora. Probá más tarde.'
  if (m.includes('needs first name')) return 'Para un DNI nuevo cargá nombre, apellido y celular.'
  return 'No pudimos guardar el cambio. Probá de nuevo.'
}

async function run<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await p
  if (error) throw new Error(adminErrorMessage(error.message))
  return data
}

export interface MembershipChange {
  membershipId: string
  roles?: Role[]
  teamId?: string | null
  status?: MembershipStatus
  startsOn?: string
  /** Own hours, or null to use the company's. */
  shift?: { start: string; end: string } | null
  autoApprove?: boolean
}

export function useAdminPeople(companyId: string) {
  const qc = useQueryClient()
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['admin'] }), qc.invalidateQueries({ queryKey: ['team'] }), qc.invalidateQueries({ queryKey: operationKeys.people(companyId) })])
  const update = useMutation({
    mutationFn: ({ membershipId, roles, teamId, status, startsOn, shift, autoApprove }: MembershipChange) =>
      run(
        supabase
          .from('membership')
          .update({ roles, team_id: teamId, status, starts_on: startsOn, auto_approve: autoApprove, ...(shift === undefined ? {} : { shift_start: shift?.start ?? null, shift_end: shift?.end ?? null }) })
          .eq('id', membershipId)
          .select('id')
          .single(),
      ),
    onSettled: refresh,
  })
  const saveTeam = useMutation({
    mutationFn: async (t: { id?: string; name: string; areas: string | null }) =>
      t.id
        ? run(supabase.from('team').update({ name: t.name, areas: t.areas }).eq('id', t.id).select('id').single())
        : run(supabase.from('team').insert({ company_id: companyId, name: t.name, areas: t.areas }).select('id').single()),
    onSettled: refresh,
  })
  const removeTeam = useMutation({
    mutationFn: (id: string) => run(supabase.from('team').delete().eq('id', id).select('id')),
    onSettled: refresh,
  })
  return { update, saveTeam, removeTeam }
}

export interface FoundPerson {
  personId: string
  firstName: string
  lastName: string
  phoneLast4: string | null
  isMember: boolean
}

/** By DNI: the person if Visitario knows them (the lookup is logged and rate limited). */
export async function findByDni(companyId: string, dni: string): Promise<FoundPerson | null> {
  const data = await run(supabase.rpc('find_person_by_dni', { p_company: companyId, p_dni: dni }))
  const r = data?.[0]
  return r ? { personId: r.person_id, firstName: r.first_name, lastName: r.last_name, phoneLast4: r.phone_last4, isMember: r.is_member } : null
}

export interface Invite {
  dni: string
  roles: Role[]
  teamId: string | null
  startsOn: string
  firstName?: string
  lastName?: string
  phone?: string
}

export function useInvite(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: Invite) =>
      run(
        supabase.rpc('invite_person', {
          p_company: companyId,
          p_dni: i.dni,
          p_roles: i.roles,
          p_team: i.teamId as string,
          p_starts_on: i.startsOn,
          p_first_name: i.firstName,
          p_last_name: i.lastName,
          p_phone: i.phone,
        }),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  })
}
