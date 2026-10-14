import { describe, expect, it } from 'vitest'
import { mapsQuery, mapsSearchUrl, parseLocation } from './places'

describe('Google Maps', () => {
  it('searches the address in the city, never the coordinates or the zone', () => {
    expect(mapsQuery({ address: 'Gral. José Gervasio Artigas 4965 ' })).toBe('Gral. José Gervasio Artigas 4965, Buenos Aires, Argentina')
    const url = new URL(mapsSearchUrl({ address: 'Moldes 1365' }))
    expect(url.searchParams.get('query')).toBe('Moldes 1365, Buenos Aires, Argentina')
  })
})

describe('a location pasted by hand', () => {
  it('coordinates as Google Maps copies them', () => {
    expect(parseLocation('-34.58784, -58.49370')).toEqual({ lat: -34.58784, lng: -58.4937 })
    expect(parseLocation(' -34.58784 -58.49370 ')).toEqual({ lat: -34.58784, lng: -58.4937 })
  })

  it("a place's link: the pin, not where the map is centred", () => {
    const link = 'https://www.google.com/maps/place/Artigas+4965/@-34.5870,-58.4950,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-34.5878425!4d-58.4936994'
    expect(parseLocation(link)).toEqual({ lat: -34.5878425, lng: -58.4936994 })
  })

  it('a map link or a search link', () => {
    expect(parseLocation('https://www.google.com/maps/@-34.5651,-58.4553,18z')).toEqual({ lat: -34.5651, lng: -58.4553 })
    expect(parseLocation('https://maps.google.com/?q=-34.5651,-58.4553')).toEqual({ lat: -34.5651, lng: -58.4553 })
  })

  it('nothing usable: text, a short link, or a place outside Argentina', () => {
    expect(parseLocation('Artigas 4965')).toBeNull()
    expect(parseLocation('https://maps.app.goo.gl/abc123')).toBeNull()
    expect(parseLocation('-58.49370, -34.58784')).toBeNull() // swapped
    expect(parseLocation('40.4168, -3.7038')).toBeNull()
  })
})
