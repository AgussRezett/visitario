import { describe, expect, it } from 'vitest'
import { NO_DIRECTORY_FILTERS, readDirectoryFilters } from './directory-filters'

describe('directory filters kept in the tab', () => {
  it('come back as they were saved', () => {
    const f = { query: 'coto', filter: 'unverified', area: 'Palermo', channel: 0, seller: 3, page: 2 }
    expect(readDirectoryFilters(JSON.stringify(f))).toEqual(f)
  })

  it('start empty when there is nothing, or it is broken', () => {
    expect(readDirectoryFilters(null)).toEqual(NO_DIRECTORY_FILTERS)
    expect(readDirectoryFilters('{nope')).toEqual(NO_DIRECTORY_FILTERS)
    expect(readDirectoryFilters('"text"')).toEqual(NO_DIRECTORY_FILTERS)
  })

  it('drop values that do not fit', () => {
    expect(readDirectoryFilters(JSON.stringify({ filter: 'weird', channel: -1, seller: 'x', page: 1.5, area: '' })))
      .toEqual(NO_DIRECTORY_FILTERS)
  })
})
