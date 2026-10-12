import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('keeps a color next to a custom font size', () => {
    expect(cn('text-action-ink', 'text-label')).toBe('text-action-ink text-label')
  })
  it('still resolves conflicting colors', () => {
    expect(cn('text-ink', 'text-forest')).toBe('text-forest')
  })
})
