import { describe, expect, it } from 'vitest'
import { activeMention, extractMentions, findByName, insertMention, matchMentions } from './mentions'

const sellers = [
  { id: 1, name: 'Florencia' },
  { id: 2, name: 'Florencia Gómez' },
  { id: 3, name: 'Martín Sosa' },
]
const channels = [
  { id: 10, name: 'Autoservicio' },
  { id: 11, name: 'Drugstore / Kiosco / Kiosco ventana' },
  { id: 12, name: 'Almacén / Despensa' },
]

describe('mentions', () => {
  it('knows the mention being typed at the caret', () => {
    expect(activeMention('1462; Altolaguirre 1952 @flo', 28)).toEqual({ trigger: '@', query: 'flo', start: 24 })
    expect(activeMention('Cuba 2200 #kio', 14)).toEqual({ trigger: '#', query: 'kio', start: 10 })
    expect(activeMention('@Martín So', 10)?.query).toBe('Martín So')
    expect(activeMention('mail@algo', 9)).toBeNull()
    expect(activeMention('@Flor; Cuba 2200', 16)).toBeNull()
    expect(activeMention('@Flor\nCuba', 10)).toBeNull()
    expect(activeMention('Cuba 2200 @Florencia ', 21)).toBeNull()
  })

  it('suggests by the start of the name or of any word, ignoring accents', () => {
    expect(matchMentions(sellers, 'flo').map((s) => s.id)).toEqual([1, 2])
    expect(matchMentions(sellers, 'gom').map((s) => s.id)).toEqual([2])
    expect(matchMentions(sellers, 'martin').map((s) => s.id)).toEqual([3])
    expect(matchMentions(channels, 'kiosco').map((c) => c.id)).toEqual([11])
    expect(matchMentions(channels, '').length).toBe(3)
  })

  it('puts the chosen name in place of what was typed', () => {
    expect(insertMention('Cuba 2200 @flo', 10, 14, '@', 'Florencia')).toEqual({ text: 'Cuba 2200 @Florencia ', caret: 21 })
    expect(insertMention('@fl; Cuba 2200', 0, 3, '@', 'Florencia').text).toBe('@Florencia ; Cuba 2200')
  })

  it('takes seller and channel out of a line, longest name first', () => {
    expect(extractMentions('1462; Altolaguirre 1952 @Florencia #Autoservicio', sellers, channels)).toEqual({ rest: '1462; Altolaguirre 1952', sellerId: 1, channelId: 10, unknown: [] })
    expect(extractMentions('@florencia gomez; Cuba 2200', sellers, channels)).toMatchObject({ rest: 'Cuba 2200', sellerId: 2 })
    expect(extractMentions('Cuba 2200; #Drugstore / Kiosco / Kiosco ventana; Belgrano', sellers, channels)).toMatchObject({ rest: 'Cuba 2200; Belgrano', channelId: 11 })
    expect(extractMentions('Cuba 2200 @Pedro', sellers, channels)).toMatchObject({ rest: 'Cuba 2200', sellerId: null, unknown: ['@Pedro'] })
    expect(extractMentions('Amenábar 1260', sellers, channels)).toEqual({ rest: 'Amenábar 1260', sellerId: null, channelId: null, unknown: [] })
  })
})

describe('findByName', () => {
  const numbered = channels.map((c, i) => ({ ...c, number: i + 1 }))
  it('reads a spreadsheet cell as a seller or channel', () => {
    expect(findByName('FLORENCIA', sellers)?.id).toBe(1)
    expect(findByName('florencia gomez', sellers)?.id).toBe(2)
    expect(findByName('Martín', sellers)?.id).toBe(3)
    expect(findByName('Pedro', sellers)).toBeNull()
    expect(findByName('1. AUTOSERVICIO', numbered)?.id).toBe(10)
    expect(findByName('2', numbered)?.id).toBe(11)
    expect(findByName('DRUGSTORE/KIOSCO/KIOSCO VENTANA', numbered)?.id).toBe(11)
    expect(findByName('', numbered)).toBeNull()
  })
})
