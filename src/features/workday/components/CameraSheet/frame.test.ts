import { describe, expect, it } from 'vitest'
import { focusPoint, shotSize, turnFor, turnedSize } from './frame'

describe('camera picture', () => {
  it('stays standing when the phone is upright, flat or the screen already turned', () => {
    expect(turnFor({ x: 0.3, y: 9.7 }, false, 0)).toBe(0)
    expect(turnFor({ x: 1, y: 1 }, false, 0)).toBe(0) // flat on a table
    expect(turnFor({ x: -9.6, y: 0.5 }, false, 90)).toBe(0)
    expect(turnFor(null, false, 0)).toBe(0)
  })

  it('lies down when the phone is held sideways, the right way round on Android and iPhone', () => {
    expect(turnFor({ x: -9.6, y: 0.8 }, false, 0)).toBe(90) // top to the right
    expect(turnFor({ x: 9.6, y: 0.8 }, false, 0)).toBe(-90) // top to the left
    expect(turnFor({ x: 9.6, y: -0.8 }, true, 0)).toBe(90) // iPhone: same pose, signs flipped
  })

  it('swaps width and height once turned', () => {
    expect(turnedSize(1440, 1920, 90)).toEqual({ width: 1920, height: 1440 })
    expect(turnedSize(1440, 1920, 0)).toEqual({ width: 1440, height: 1920 })
  })

  it('maps a tap on the preview to the picture, inside the black bars', () => {
    // A 390×700 preview showing a 1440×1920 stream: 390×520 tall, 90 px bars above and below.
    expect(focusPoint({ x: 195, y: 350 }, { width: 390, height: 700 }, { width: 1440, height: 1920 })).toEqual({ x: 0.5, y: 0.5 })
    expect(focusPoint({ x: 0, y: 10 }, { width: 390, height: 700 }, { width: 1440, height: 1920 })).toEqual({ x: 0, y: 0 })
  })
})

describe('the shot', () => {
  it('comes out at the kept size, turned when the phone is sideways', () => {
    expect(shotSize(1440, 1920, 0, 1400)).toEqual({ draw: { width: 1050, height: 1400 }, width: 1050, height: 1400 })
    expect(shotSize(1440, 1920, 90, 1400)).toEqual({ draw: { width: 1050, height: 1400 }, width: 1400, height: 1050 })
    expect(shotSize(1920, 1440, 0, 1400)).toEqual({ draw: { width: 1400, height: 1050 }, width: 1400, height: 1050 })
    // A small camera is never enlarged.
    expect(shotSize(640, 480, 0, 1400)).toEqual({ draw: { width: 640, height: 480 }, width: 640, height: 480 })
  })
})
