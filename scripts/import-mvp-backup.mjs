// Imports an MVP backup (visitario-respaldo-*.json) into Visitario as your own work:
//   1. builds the data (workdays, stores, visits, displays, work, brands, photo rows),
//   2. signs you in and calls import_mvp_backup (platform admins only),
//   3. uploads every photo through the photos function, into R2.
// Merges into what Visitario already has: a day that already has a workday gets the backup's
// stops there, known stores are reused, and an address the day already had is skipped (with
// its photos). Safe to run again: nothing is duplicated and uploaded photos are skipped.
//
//   node scripts/import-mvp-backup.mjs ruta/al/visitario-respaldo.json
//
// Strips EXIF/XMP (APP1) before uploading: photos never keep a location.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import readline from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

/** Same deterministic id the database import used for each photo. */
export function photoId(visit, kind, display = '') {
  const h = createHash('sha1').update(`visitario-mvp:${visit}:${kind}:${display}`).digest().subarray(0, 16)
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const x = h.toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}

/** Drops APP1 segments (EXIF, XMP) and reads the size from the frame header. */
export function stripJpeg(dataUrl) {
  const b = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
  const parts = [b.subarray(0, 2)]
  let i = 2, width = 0, height = 0
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error('Not a JPEG')
    const marker = b[i + 1]
    if (marker === 0xda) { parts.push(b.subarray(i)); break }
    const len = (b[i + 2] << 8) | b[i + 3]
    const seg = b.subarray(i, i + 2 + len)
    if (marker >= 0xc0 && marker <= 0xc2) { height = (seg[5] << 8) | seg[6]; width = (seg[7] << 8) | seg[8] }
    if (marker !== 0xe1) parts.push(seg)
    i += 2 + len
  }
  return { bytes: Buffer.concat(parts), width, height }
}

function storeId(key) {
  const h = createHash('sha1').update(`visitario-mvp-store:${key}`).digest().subarray(0, 16)
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const x = h.toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}

const at = (date, hhmm) => (/^\d{1,2}:\d{2}$/.test(hhmm ?? '') ? `${date}T${hhmm.padStart(5, '0')}:00-03:00` : null)
const TYPE = { góndola: 'Góndola', puntera: 'Puntera', otra: 'Otra' }
const BRAND = { 'Cynar clásico': 'Cynar' }
const METRIC = { units: 'Unidades repuestas', combos: 'Kits de bolsas', groupings: 'Agrupaciones', activatedEndcaps: 'Punteras activadas', assembledDisplays: 'Exhibidores armados' }
const STATUS = { completada: 'done', pendiente: 'pending', 'en curso': 'in_progress' }
const CONSENT = { autorizado: 'yes', autorizado_con_oposicion: 'with_objection' }
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** The backup in the shape import_mvp_backup expects. */
export function buildImport(backup) {
  const stores = new Map()
  const data = { stores: [], workdays: [], visits: [], displays: [], photos: [], metrics: [], brands: [] }
  for (const j of [...backup.journeys].sort((a, b) => a.date.localeCompare(b.date))) {
    data.workdays.push({ id: j.id, date: j.date })
    const vo = j.visitOrder ?? []
    const ro = j.routeOrder ?? []
    const rank = (v, i) => (vo.includes(v.id) ? [0, vo.indexOf(v.id)] : ro.includes(v.id) ? [1, ro.indexOf(v.id)] : [2, i])
    const ordered = j.visits.map((v, i) => ({ v, r: rank(v, i) })).sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1]).map((x) => x.v)
    ordered.forEach((v, sort) => {
      const key = text(v.customerNumber) ?? v.address.trim().toLowerCase()
      if (!stores.has(key)) {
        const zone = text(v.zone)
        const s = { id: storeId(key), cn: text(v.customerNumber), name: text(v.name), address: v.address.trim(),
          area: zone ? zone[0].toUpperCase() + zone.slice(1).toLowerCase() : null, lat: v.location?.lat ?? null, lng: v.location?.lon ?? null }
        stores.set(key, s)
        data.stores.push(s)
      }
      const status = STATUS[v.status]
      const arrived = at(j.date, v.arrivedAt)
      const fallback = `${j.date}T12:00:00-03:00`
      data.visits.push({ id: v.id, wd: j.id, date: j.date, store: stores.get(key).id, sort, task: text(v.task), status,
        consent: v.authorization ? CONSENT[v.authorization] ?? null : status === 'done' ? 'yes' : null,
        objection: text(v.oppositionReason), arrived, finished: status === 'done' ? arrived ?? fallback : null, notes: text(v.notes),
        approved: v.ok === 'aprobado' && status === 'done', resumed: v.originId ?? null })
      const taken = arrived ?? fallback
      const photo = (kind, dataUrl, display = null) => {
        const { bytes, width, height } = stripJpeg(dataUrl)
        data.photos.push({ id: photoId(v.id, kind, display ?? ''), visit: v.id, display, kind, taken, bytes: bytes.length, w: width, h: height })
      }
      if (v.photos?.facade) photo('storefront', v.photos.facade)
      ;(v.displayDetails ?? []).forEach((d, i) => {
        data.displays.push({ id: d.id, visit: v.id, type: TYPE[d.type] ?? 'Otra', ref: text(d.note), source: d.source === 'encontrada' ? 'found' : 'assigned', sort: i })
        for (const kind of ['before', 'after']) if (d.photos?.[kind]) photo(kind, d.photos[kind], d.id)
      })
      for (const [k, name] of Object.entries(METRIC)) if (typeof v[k] === 'number' && v[k] > 0) data.metrics.push({ visit: v.id, metric: name, qty: Math.trunc(v[k]) })
      for (const b of v.selectedBrands ?? []) data.brands.push({ visit: v.id, brand: BRAND[b] ?? b })
    })
  }
  return data
}

/** Every photo in the backup with its ids and when it was taken. */
export function photosOf(backup) {
  const out = []
  for (const j of backup.journeys) {
    for (const v of j.visits) {
      const takenAt = new Date(/^\d{1,2}:\d{2}$/.test(v.arrivedAt ?? '') ? `${j.date}T${v.arrivedAt.padStart(5, '0')}:00-03:00` : `${j.date}T12:00:00-03:00`).toISOString()
      if (v.photos?.facade) out.push({ id: photoId(v.id, 'storefront'), visitId: v.id, displayId: null, kind: 'storefront', takenAt, data: v.photos.facade })
      for (const d of v.displayDetails ?? []) {
        for (const kind of ['before', 'after']) {
          if (d.photos?.[kind]) out.push({ id: photoId(v.id, kind, d.id), visitId: v.id, displayId: d.id, kind, takenAt, data: d.photos[kind] })
        }
      }
    }
  }
  return out
}

async function main() {
  const file = process.argv[2]
  if (!file) throw new Error('Uso: node scripts/import-mvp-backup.mjs ruta/al/respaldo.json')
  const backup = JSON.parse(readFileSync(file, 'utf8'))
  const data = buildImport(backup)
  const photos = photosOf(backup)
  console.log(`Respaldo de ${backup.company}: ${data.workdays.length} jornadas, ${data.visits.length} visitas, ${photos.length} fotos.`)
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const id = (await rl.question('DNI o email: ')).trim()
  rl._writeToOutput = () => {} // hide the password while typing
  process.stdout.write('Contraseña: ')
  const password = await rl.question('')
  rl.close()
  process.stdout.write('\n')

  if (id.includes('@')) {
    const { error } = await supabase.auth.signInWithPassword({ email: id, password })
    if (error) throw new Error('El email o la contraseña no coinciden.')
  } else {
    const { data, error } = await supabase.functions.invoke('sign-in-with-dni', { body: { dni: id.replace(/\D/g, ''), password } })
    if (error || !data) throw new Error('El DNI o la contraseña no coinciden.')
    await supabase.auth.setSession(data)
  }

  const { data: memberships } = await supabase.from('membership').select('company_id, roles, company:company_id (name)').eq('status', 'active')
  const company = (memberships ?? []).find((m) => m.company?.name === backup.company && m.roles.includes('merchandiser'))
  if (!company) throw new Error(`No sos activador activo de ${backup.company}.`)
  const { data: result, error: importError } = await supabase.rpc('import_mvp_backup', { p_company: company.company_id, p_data: data })
  if (importError) throw new Error(`No se pudo importar: ${importError.message}`)
  console.log(`Importado en ${backup.company}: ${result.workdays} jornadas, ${result.visits} visitas.`)
  if (result.merged_days) console.log(`${result.merged_days} ${result.merged_days === 1 ? 'día ya tenía jornada: se sumó' : 'días ya tenían jornada: se sumaron'} a la existente.`)
  if (result.stores_reused) console.log(`${result.stores_reused} ${result.stores_reused === 1 ? 'comercio ya estaba' : 'comercios ya estaban'} en el directorio: no se duplicaron.`)
  const skipped = result.skipped ?? []
  if (skipped.length) {
    console.log(`Omitidas ${skipped.length} ${skipped.length === 1 ? 'dirección que ya estaba' : 'direcciones que ya estaban'} en su jornada:`)
    for (const v of skipped) console.log(`  ${v.date.split('-').reverse().slice(0, 2).join('/')} · ${v.address}`)
  }
  const omitted = new Set(skipped.map((v) => v.id))
  const toUpload = photos.filter((p) => !omitted.has(p.visitId))
  console.log(`Subiendo ${toUpload.length} fotos…`)

  let done = 0, failed = 0
  const queue = [...toUpload]
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const { bytes, width, height } = stripJpeg(p.data)
      const form = new FormData()
      form.append('file', new Blob([bytes], { type: 'image/jpeg' }), `${p.id}.jpg`)
      form.append('meta', JSON.stringify({ id: p.id, visitId: p.visitId, displayId: p.displayId, kind: p.kind, takenAt: p.takenAt, width, height }))
      const { error } = await supabase.functions.invoke('photos', { body: form })
      if (error) {
        failed++
        console.log(`\nNo se pudo subir ${p.kind} de la visita ${p.visitId}: ${error.message}`)
      } else done++
      process.stdout.write(`\rSubidas ${done} de ${toUpload.length}${failed ? ` · ${failed} con error` : ''}`)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  console.log(failed ? '\nVolvé a correr el script para reintentar las que fallaron.' : '\nListo: todas las fotos están en R2.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\n${e.message}`)
    process.exit(1)
  })
}
