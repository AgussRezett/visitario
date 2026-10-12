import { describe, expect, it } from 'vitest'
import { fitWithin } from './image'

describe('fitWithin', () => {
  it('scales a 12 MP phone photo to 1400 px on the long side', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1400, height: 1050 })
    expect(fitWithin(3024, 4032)).toEqual({ width: 1050, height: 1400 })
  })
  it('never enlarges', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
