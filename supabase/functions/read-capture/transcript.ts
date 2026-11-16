// What the AI is asked for: a literal transcript of the capture. It copies, the app decides
// what each column holds (src/domain/capture.ts). The answer is cleaned here, whatever the
// model sends back.

export interface Transcript {
  title: string
  headers: string[]
  rows: string[][]
  unreadable: number
}

export const PROMPT = `La imagen es una lista de comercios para visitar: una captura de un Excel, un mensaje de WhatsApp, la ficha de una app o una foto de una hoja impresa. Tu único trabajo es COPIAR lo que se ve. No interpretes, no completes, no corrijas.

Respondé solo con este JSON, sin texto antes ni después:
{"title": "", "headers": [], "rows": [], "unreadable": 0}

- title: un título que esté arriba de la lista (por ejemplo "RUTA AGUSTIN"), tal cual. "" si no hay.
- headers: los encabezados de las columnas tal como se ven, de izquierda a derecha, sin las flechas de los filtros. Si la tabla no muestra encabezados, dejá [] y no los inventes.
- rows: una lista por fila, con una celda por columna en el mismo orden que los encabezados. Copiá cada celda exactamente: mayúsculas, abreviaturas, puntos y números como están. Una celda vacía va como "".
- Si es una ficha con etiquetas y valores (por ejemplo DOMICILIO, debajo AV. RIVADAVIA 1234, después COD, debajo 564), las etiquetas van en headers y los valores en una sola fila, en el mismo orden. Una etiqueta sin valor queda con "". Si hay varias fichas iguales, una fila por ficha.
- No agregues filas, columnas ni datos que no estén en la imagen. No completes direcciones, números ni nombres cortados. No repitas filas.
- Si una fila no se puede leer bien, no la adivines: no la copies y sumá 1 a unreadable.
- Ignorá totales, fechas sueltas y texto que no sea parte de la lista.`

const CELL = { type: 'string' }
export const SCHEMA = {
  type: 'object',
  properties: {
    title: CELL,
    headers: { type: 'array', items: CELL },
    rows: { type: 'array', items: { type: 'array', items: CELL } },
    unreadable: { type: 'integer' },
  },
  required: ['title', 'headers', 'rows', 'unreadable'],
  additionalProperties: false,
}

const MAX_ROWS = 300
const MAX_COLUMNS = 12

// Filter arrows and sort marks copied from Excel titles ("CLIENTE ▼").
const cell = (v: unknown) =>
  (typeof v === 'string' || typeof v === 'number' ? String(v) : '')
    .replace(/[▼▾▲▴⏷⏶↓↑↕⇅]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

/** The model's answer as a transcript; null when it is not one. Code fences and chatter around the JSON are dropped. */
export function toTranscript(answer: unknown): Transcript | null {
  let raw = answer
  if (typeof raw === 'string') {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      raw = JSON.parse(raw.slice(start, end + 1))
    } catch {
      return null
    }
  }
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.rows)) return null
  const headers = (Array.isArray(o.headers) ? o.headers : []).slice(0, MAX_COLUMNS).map(cell)
  const seen = new Set<string>()
  const rows = o.rows
    .filter(Array.isArray)
    .map((r) => (r as unknown[]).slice(0, MAX_COLUMNS).map(cell))
    .filter((r) => {
      // The same row twice (in the list or repeated by the model) is one visit.
      const key = r.join('|')
      if (!r.some(Boolean) || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_ROWS)
  const unreadable = Math.max(0, Math.min(MAX_ROWS, Math.trunc(Number(o.unreadable)) || 0))
  return { title: cell(o.title), headers: headers.some(Boolean) ? headers : [], rows, unreadable }
}
