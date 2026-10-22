// What the fake Supabase holds for a test (see fake-supabase.ts).
export type Row = Record<string, unknown>

export interface FakeState {
  /** Signed photo links (https://photos.test/<id>.jpg); the spec serves them. */
  photoUrls?: boolean
  workday: Row | null
  visits: Row[]
  uploads: { bytes: Buffer; meta: Row }[]
  /** Defaults to one Panda merchandiser membership. */
  memberships?: Row[]
  /** Supervisor side: comments, people of the team, workdays planned, sync reports received. */
  comments?: Row[]
  people?: Row[]
  workdays?: Row[]
  reports?: Row[]
  /** Admin: company_people rows, teams, and people Visitario knows by DNI. */
  members?: Row[]
  teams?: Row[]
  dnis?: Record<string, Row>
  /** tag_store calls: the store's channel and seller. */
  tagged?: Row[]
  /** Operativos: day_operations rows, the activadores to pick, and the actions called. */
  operations?: Row[]
  teammates?: Row[]
  operationCalls?: Row[]
  /** Let the install guide open by itself (other tests keep it away). */
  installOffer?: boolean
  /** A seller's clients (seller_stores). */
  clients?: Row[]
  catalogs?: Partial<Record<'brand' | 'display_type' | 'work_metric' | 'channel' | 'seller', Row[]>>
  /** The company's own row and templates. */
  company?: Row
  templates?: Row[]
  subscription?: Row
  usage?: Row
  /** Stops of other people's days that day_overlaps reports (store_id / address / customer_number to match). */
  overlaps?: Row[]
  /** Import: the directory, saved formats and what the geocoder finds (by address). */
  stores?: Row[]
  /** Pending stops from today on, per store (what archiving removes). */
  openStops?: Record<string, number>
  /** Assigning: the merchandiser's pending stops offered, and the ones added. */
  pending?: Row[]
  resumed?: string[]
  formats?: Row[]
  geocode?: Record<string, Row>
  /** What the route function answers by streets (503 without it) and what it was asked. */
  route?: Row
  routeAsked?: Row[]
  /** What reading a capture with AI answers: rows, or an error status. */
  capture?: { rows?: Row[]; unreadable?: number; status?: number }
  /** Reputation: store_reputation rows and rapport_facts rows (by week). */
  reputation?: Row[]
  rapportFacts?: Row[]
  /** Pending visits of earlier days offered to resume, and the ones discarded. */
  resumable?: Row[]
  dismissed?: string[]
  /** Work totals per day and merchandiser (the daily_metrics view). */
  dailyMetrics?: Row[]
  /** Simulates a slow connection when loading a day. */
  workdayDelayMs?: number
  /** Answer photo uploads with this status (e.g. 503 down, 403 refused) instead of storing them. */
  photoStatus?: number
  /** Simulates a slow connection for photo uploads. */
  uploadDelayMs?: number
  /** Super admin: platform_companies rows, what was created, support sessions opened. */
  platform?: { companies: Row[]; created?: Row[]; sessions?: Row[]; snapshot?: Row }
  /** What a company admin sees in "Accesos de soporte". */
  supportLog?: Row[]
  /** Invitations by email: the admin's list, what was sent, and the link's side. */
  invite?: {
    list?: Row[]; sent?: boolean; created?: Row[]; resent?: string[]; canceled?: string[]
    preview?: Row; accepted?: Row[]; acceptError?: string; mine?: Row[]; signups?: Row[]; emailTaken?: boolean; noPerson?: boolean
  }
}
