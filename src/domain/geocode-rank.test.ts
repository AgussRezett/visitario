import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { barrioOf, inCaba, numberOf, rank, type Candidate } from './geocode-rank'

const c = (extra: Partial<Candidate>): Candidate => ({ lat: -34.6, lng: -58.42, label: '', road: 'Yatay', houseNumber: '461', suburb: 'Almagro', state: 'Ciudad Autónoma de Buenos Aires', county: null, city: null, ...extra })
// What LocationIQ answered for "Yatay 461" inside the old box: a Yatay in Valentín Alsina, Lanús.
const lanus = c({ lat: -34.66641, lng: -58.41121, suburb: 'Valentín Alsina', state: 'Buenos Aires', county: 'Partido de Lanús' })
const almagro = c({ lat: -34.6049, lng: -58.4233 })

describe('geocode ranking', () => {
  it('reads the street number and the barrio from what people write', () => {
    expect(numberOf('Yatay 461')).toBe('461')
    expect(numberOf('Av. 9 de Julio 1200')).toBe('1200')
    expect(numberOf('Yatay')).toBeNull()
    expect(barrioOf('almagro')).toBe('Almagro')
    expect(barrioOf('Paternal')).toBe('La Paternal')
    expect(barrioOf('Villa Urquiza 2')).toBeNull() // a company's own zone name
  })

  it('a place in the province is not in the City, even inside the old box', () => {
    expect(inCaba(lanus)).toBe(false)
    expect(inCaba(almagro)).toBe(true)
    expect(inCaba(c({ state: 'Buenos Aires', county: null, city: 'Buenos Aires' }))).toBe(true)
    expect(inCaba(c({ state: 'Buenos Aires', county: 'Partido de Avellaneda', city: 'Avellaneda' }))).toBe(false)
  })

  it('Yatay 461 lands in Almagro, never in Valentín Alsina', () => {
    const r = rank([lanus, almagro], 'Yatay 461', { caba: true, barrio: 'Almagro' })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ lat: -34.6049, exact: true })
  })

  it('the same street number wins; another number is only approximate', () => {
    const r = rank([c({ houseNumber: '500', lat: -34.61 }), c({ houseNumber: '461' })], 'Yatay 461', { caba: true, barrio: null })
    expect(r.map((x) => [x.houseNumber, x.exact])).toEqual([['461', true], ['500', false]])
  })

  it('the whole country keeps the province', () => {
    expect(rank([lanus], 'Yatay 461', { caba: false, barrio: null })).toHaveLength(1)
  })

  it('the Edge Function runs this same file', () => {
    const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')
    expect(read('../../supabase/functions/geocode/rank.ts')).toBe(read('./geocode-rank.ts'))
  })
})
