import { describe, expect, it } from 'vitest'
import { NO_DIRECTORY_FILTERS, headerSort, readDirectoryFilters } from './directory-filters'

describe('directory filters kept in the tab', () => {
  it('come back as they were saved', () => {
    const f = { query: 'coto', filter: 'unverified', areas: ['Palermo', 'Almagro'], channels: [0, 2], sellers: [3], sort: 'oldest_visit', page: 2 }
    expect(readDirectoryFilters(JSON.stringify(f))).toEqual(f)
  })

  it('read the single values an older version saved', () => {
    expect(readDirectoryFilters(JSON.stringify({ area: 'Palermo', channel: 0, seller: 3 }))).toMatchObject({ areas: ['Palermo'], channels: [0], sellers: [3] })
  })

  it('start empty when there is nothing, or it is broken', () => {
    expect(readDirectoryFilters(null)).toEqual(NO_DIRECTORY_FILTERS)
    expect(readDirectoryFilters('{nope')).toEqual(NO_DIRECTORY_FILTERS)
    expect(readDirectoryFilters('"text"')).toEqual(NO_DIRECTORY_FILTERS)
  })

  it('drop values that do not fit', () => {
    expect(readDirectoryFilters(JSON.stringify({ filter: 'weird', channel: -1, seller: 'x', page: 1.5, area: '', sort: 'random' })))
      .toEqual(NO_DIRECTORY_FILTERS)
  })
})

describe('sorting from the table headers', () => {
  it('each column sorts by itself; last visit flips between recent and longest ago', () => {
    expect(headerSort('customer', 'name')).toBe('customer')
    expect(headerSort('visits', 'name')).toBe('most_visits')
    expect(headerSort('last_visit', 'name')).toBe('recent_visit')
    expect(headerSort('last_visit', 'recent_visit')).toBe('oldest_visit')
    expect(headerSort('last_visit', 'oldest_visit')).toBe('recent_visit')
  })
})
