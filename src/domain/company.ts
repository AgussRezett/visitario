import type { Enums } from '@/lib/supabase'
import { formatDayMonth } from './dates'

export type PlanKind = Enums<'plan_kind'>
export type CompanyKind = Enums<'company_kind'>

export const PLAN_LABEL: Record<PlanKind, string> = { free: 'Plan gratuito', pilot: 'Plan piloto', team: 'Plan Equipo', internal: 'Plan interno' }
export const KIND_LABEL: Record<CompanyKind, string> = { distributor: 'Distribuidora', brand: 'Marca', agency: 'Agencia', personal: 'Uso propio' }
export const RETENTION_MONTHS = [3, 6, 12, 24, 36] as const

export interface Subscription {
  plan: PlanKind
  status: Enums<'subscription_status'>
  endsOn: string | null
  nextBillingOn: string | null
  autoDebit: boolean
  paymentMethod: string | null
  estimatedAmountCents: number | null
  currency: string
}

/** "2,1 GB", "830 MB", as people read storage. */
export function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  const digits = value < 10 && unit > 0 ? 1 : 0
  return `${value.toLocaleString('es-AR', { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[unit]}`
}

/** "$ 45.000" in the subscription's currency, or the placeholder while the price is not set. */
export function formatAmount(cents: number | null, currency: string) {
  if (cents === null) return 'A definir'
  return (cents / 100).toLocaleString('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 })
}

/** The line about what happens next with the plan, if anything. */
export function planNotice(s: Subscription): { tone: 'info' | 'warn' | 'error'; title: string; text: string } | null {
  if (s.status === 'expired') return { tone: 'error', title: 'El plan venció', text: 'Las funciones pagas están en pausa hasta renovarlo. Escribinos para seguir.' }
  if (s.status === 'canceled') return { tone: 'warn', title: 'El plan está cancelado', text: s.endsOn ? `Sigue activo hasta el ${formatDayMonth(s.endsOn, true)}.` : 'Escribinos si querés volver.' }
  if (s.plan === 'pilot' && s.endsOn) return { tone: 'info', title: `El piloto termina el ${formatDayMonth(s.endsOn, true)}`, text: 'Después sigue el plan Equipo, si no lo cancelás antes.' }
  if (s.endsOn && !s.autoDebit) return { tone: 'warn', title: `El plan vence el ${formatDayMonth(s.endsOn, true)}`, text: 'Sin débito automático, las funciones pagas se pausan hasta renovar.' }
  return null
}

/** A CSV that Excel in Spanish opens right: semicolons, quotes when needed, BOM for accents. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}
