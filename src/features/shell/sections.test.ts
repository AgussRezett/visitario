import { describe, expect, it } from 'vitest'
import { SECTIONS, splitTabs } from './sections'

describe('phone tabs', () => {
  it('keep every section when they fit in 5', () => {
    expect(splitTabs(SECTIONS.merchandiser)).toEqual({ tabs: SECTIONS.merchandiser, more: [] })
  })

  it('past 5: 4 tabs, the ones marked "more" go under Más', () => {
    const { tabs, more } = splitTabs(SECTIONS.supervisor)
    expect(tabs.map((s) => s.slug)).toEqual(['today', 'review', 'assign', 'stores'])
    expect(more.map((s) => s.slug)).toEqual(['issues', 'map', 'reports'])
    const admin = splitTabs(SECTIONS.admin)
    expect(admin.tabs.map((s) => s.slug)).toEqual(['users', 'catalogs', 'stores', 'map'])
    expect(admin.more.map((s) => s.slug)).toEqual(['templates', 'company', 'reports'])
  })
})
