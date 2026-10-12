// Dates are plain 'YYYY-MM-DD' strings in Argentina time (UTC-3, no daylight saving).
export const AR_TIMEZONE = 'America/Argentina/Buenos_Aires'

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Today's date in Argentina, e.g. '2026-10-13'. */
export function todayInArgentina(now: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AR_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

function parts(date: string) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
}

/** '2026-10-13' → 'Lunes 13 de octubre'. */
export function formatLongDate(date: string) {
  const { m, d, weekday } = parts(date)
  return `${WEEKDAYS[weekday]} ${d} de ${MONTHS[m - 1]}`
}

/** '2026-10-10' → 'Vie 10/10'. */
export function formatShortWeekday(date: string) {
  const { m, d, weekday } = parts(date)
  return `${WEEKDAYS_SHORT[weekday]} ${d}/${m}`
}

/** '2026-10-09' → '09/10' (daily report) or '09/10/2026' (messages). */
export function formatDayMonth(date: string, withYear = false) {
  const { y, m, d } = parts(date)
  const dm = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  return withYear ? `${dm}/${y}` : dm
}

/** ISO timestamp → '14:12' in Argentina. */
export function formatTime(iso: string) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: AR_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

/** ISO timestamp → '17 h' or '17:30 h', as people say it. */
export function formatHour(iso: string) {
  const t = formatTime(iso)
  return `${t.endsWith(':00') ? t.slice(0, -3) : t} h`
}

/** A given hour of a date in Argentina, as an ISO timestamp. */
export function argentinaTime(date: string, hour: number) {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00-03:00`).toISOString()
}
