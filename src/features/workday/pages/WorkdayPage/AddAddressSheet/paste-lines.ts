import { parseLine } from '@/domain/import'
import { extractMentions, type Mentionable } from '@/domain/mentions'

export interface PastedLine {
  text: string
  customerNumber: string
  address: string
  area: string
  sellerId: number | null
  channelId: number | null
  unknown: string[]
}

/** A store per line: "12345; Tres Arroyos 762; Paternal @Florencia #Autoservicio", parts in any order. */
export function readLines(pasted: string, sellers: readonly Mentionable[], channels: readonly Mentionable[]): PastedLine[] {
  return pasted
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text) => {
      const m = extractMentions(text, sellers, channels)
      return { text, ...parseLine(m.rest), sellerId: m.sellerId, channelId: m.channelId, unknown: m.unknown }
    })
    .filter((l) => l.address || l.customerNumber)
}

/** "3 locales · 2 con nro. de cliente · 1 con vendedor", as the merchandiser types. */
export function pastedHelp(lines: PastedLine[], mentions: boolean) {
  if (!lines.length) {
    const tip = mentions ? ' Con @ elegís el vendedor y con # el canal.' : ''
    return `Separá con ; o coma, en cualquier orden. Los nuevos se agregan sin ubicación; los verificás después.${tip}`
  }
  const count = (f: (l: PastedLine) => unknown) => lines.filter(f).length
  const parts = [`${lines.length} ${lines.length === 1 ? 'local' : 'locales'}`]
  const withNumber = count((l) => l.customerNumber)
  const withArea = count((l) => l.area)
  const withSeller = count((l) => l.sellerId)
  const withChannel = count((l) => l.channelId)
  if (withNumber) parts.push(`${withNumber} con nro. de cliente`)
  if (withArea) parts.push(`${withArea} con zona`)
  if (withSeller) parts.push(`${withSeller} con vendedor`)
  if (withChannel) parts.push(`${withChannel} con canal`)
  return `${parts.join(' · ')}. Los que ya están en el directorio se reconocen.`
}
