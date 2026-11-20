import { supabase } from '@/lib/supabase'
import { readLocal } from '@/lib/storage'

const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'

export interface ReportInput {
  /** 'crash' from the error screen; 'manual' when the person writes in from their profile. */
  kind: 'crash' | 'manual'
  message: string
  detail?: string | null
  comment?: string | null
}

/** The company open on this device, if any (read directly: a crash may happen outside the providers). */
function openCompany(): string | null {
  try {
    const raw = readLocal('visitario.activeRole')
    return raw ? (JSON.parse(raw) as { companyId?: string }).companyId ?? null : null
  } catch {
    return null
  }
}

/** What a thrown value says, for the report and the screen. */
export function describeError(error: unknown): { message: string; detail: string | null } {
  if (error instanceof Error) return { message: error.message || error.name, detail: error.stack?.slice(0, 4000) ?? null }
  if (typeof error === 'string') return { message: error, detail: null }
  try {
    return { message: JSON.stringify(error).slice(0, 500), detail: null }
  } catch {
    return { message: 'Error desconocido', detail: null }
  }
}

/** Sends a report to Visitario (stored and emailed). Throws when it could not go. */
export async function sendReport(input: ReportInput): Promise<void> {
  const { error } = await supabase.functions.invoke('report-error', {
    body: {
      ...input,
      url: `${location.pathname}${location.search}`,
      appVersion: APP_VERSION,
      companyId: openCompany(),
    },
  })
  if (error) throw new Error('report')
}
