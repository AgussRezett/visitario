/**
 * Mentions in pasted lines, as in WhatsApp: "@Florencia" names the store's seller and
 * "#Autoservicio" its channel. Names can have spaces and accents; matching ignores both
 * case and accents.
 */

export type MentionTrigger = '@' | '#'

export interface Mentionable {
  id: number
  name: string
}

/** Lowercase and without accents, one character for each one of the input. */
const fold = (text: string) => [...text].map((c) => (c.normalize('NFD')[0] ?? c).toLowerCase()).join('')

/** Where a mention may start: the line's start, or after a space or a separator. */
const startsMention = (text: string, at: number) => at === 0 || /[\s;,\t]/.test(text[at - 1] ?? '')
/** Where a mention ends: the end, or a space or separator right after the name. */
const endsMention = (text: string, at: number) => at >= text.length || /[\s;,\t]/.test(text[at] ?? '')

/**
 * The mention being typed where the caret is: "@flo|" → trigger @, query "flo".
 * Null when the caret is not right after one (the query has no line break or separator)
 * or right after a space.
 */
export function activeMention(text: string, caret: number): { trigger: MentionTrigger; query: string; start: number } | null {
  const before = text.slice(0, caret)
  for (let i = before.length - 1; i >= 0 && before.length - i <= 40; i--) {
    const c = before[i]
    if (c === '\n' || c === ';' || c === ',' || c === '\t') return null
    if ((c === '@' || c === '#') && startsMention(before, i)) {
      const query = before.slice(i + 1)
      // A space right before the caret: the mention is done (a name was chosen or typed)
      return /\s$/.test(query) ? null : { trigger: c, query, start: i }
    }
  }
  return null
}

/** Candidates for a query: names starting with it first, then any word starting with it. */
export function matchMentions<T extends Mentionable>(list: readonly T[], query: string, limit = 6): T[] {
  const q = fold(query.trim())
  if (!q) return list.slice(0, limit)
  const starts = list.filter((m) => fold(m.name).startsWith(q))
  const words = list.filter((m) => !starts.includes(m) && fold(m.name).split(/[\s/]+/).some((w) => w.startsWith(q)))
  return [...starts, ...words].slice(0, limit)
}

/** Puts the chosen name in place of what was typed, and a space after it. */
export function insertMention(text: string, start: number, caret: number, trigger: MentionTrigger, name: string) {
  const after = text.slice(caret).replace(/^[^\s;,\t]*/, '')
  const inserted = `${trigger}${name}${/^\s/.test(after) ? '' : ' '}`
  const caretAt = start + inserted.length + (/^\s/.test(after) ? 1 : 0)
  return { text: text.slice(0, start) + inserted + after, caret: caretAt }
}

export interface LineMentions {
  /** The line without its mentions, to read address, number and area from. */
  rest: string
  sellerId: number | null
  channelId: number | null
  /** Mentions that name no one: "@Pedro" when Pedro is not a seller. */
  unknown: string[]
}

/** The longest name of the list written right after the trigger at `at`. */
function nameAt<T extends Mentionable>(line: string, at: number, list: readonly T[]) {
  const folded = fold(line.slice(at + 1))
  return [...list]
    .sort((a, b) => b.name.length - a.name.length)
    .find((m) => folded.startsWith(fold(m.name)) && endsMention(line, at + 1 + m.name.length))
}

/** Takes the @seller and #channel out of a line. The last one of each kind counts. */
export function extractMentions(line: string, sellers: readonly Mentionable[], channels: readonly Mentionable[]): LineMentions {
  let rest = ''
  let sellerId: number | null = null
  let channelId: number | null = null
  const unknown: string[] = []
  let i = 0
  while (i < line.length) {
    const c = line[i]
    if ((c === '@' || c === '#') && startsMention(line, i)) {
      const found = nameAt(line, i, c === '@' ? sellers : channels)
      if (found) {
        if (c === '@') sellerId = found.id
        else channelId = found.id
        i += 1 + found.name.length
        continue
      }
      const word = /^\S+/.exec(line.slice(i + 1))?.[0] ?? ''
      if (word) {
        unknown.push(`${c}${word}`)
        i += 1 + word.length
        continue
      }
    }
    rest += c
    i++
  }
  const clean = rest.replace(/\s+/g, ' ').replace(/\s*([;,])\s*(?=[;,]|$)/g, '').replace(/^[\s;,]+|[\s;,]+$/g, '').trim()
  return { rest: clean, sellerId, channelId, unknown }
}

const plain = (t: string) => fold(t).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * The seller or channel a spreadsheet cell names: the same name, "1. AUTOSERVICIO" or just
 * "1" (the channel's number), or the only one whose name starts like it ("Flor").
 */
export function findByName<T extends Mentionable & { number?: number }>(raw: string, list: readonly T[]): T | null {
  const text = plain(raw.replace(/^\s*\d+\s*[.)-]\s*/, ''))
  const number = /^\s*(\d+)\s*[.)-]?\s*$/.exec(raw)?.[1]
  if (number) return list.find((x) => x.number === Number(number)) ?? null
  if (!text) return null
  const same = list.find((x) => plain(x.name) === text)
  if (same) return same
  const starts = list.filter((x) => plain(x.name).startsWith(text) || text.startsWith(plain(x.name)))
  return starts.length === 1 ? (starts[0] ?? null) : null
}
