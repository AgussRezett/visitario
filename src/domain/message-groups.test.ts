import { describe, expect, it } from 'vitest'
import { messageGroups } from './message-groups'

// A puntera, two primarias and three góndolas, in the order they were added.
const displays = [
  { id: 'g1', typeId: 3, name: 'Góndola' }, { id: 'p', typeId: 1, name: 'Puntera' }, { id: 'r1', typeId: 2, name: 'Primaria' },
  { id: 'g2', typeId: 3, name: 'Góndola' }, { id: 'r2', typeId: 2, name: 'Primaria' }, { id: 'g3', typeId: 3, name: 'Góndola' },
]

describe('how many ANTES or DESPUÉS messages', () => {
  it('one per kind of display: three messages, each with all of its displays', () => {
    expect(messageGroups(displays, 'type')).toEqual([
      { key: 'type-3', label: 'Góndola (3)', displayIds: ['g1', 'g2', 'g3'], displays: '3 Góndola' },
      { key: 'type-1', label: 'Puntera', displayIds: ['p'], displays: 'Puntera' },
      { key: 'type-2', label: 'Primaria (2)', displayIds: ['r1', 'r2'], displays: '2 Primaria' },
    ])
  })

  it('one per display, numbered when the kind repeats', () => {
    expect(messageGroups(displays, 'display').map((g) => g.label)).toEqual(['Góndola 1', 'Puntera', 'Primaria 1', 'Góndola 2', 'Primaria 2', 'Góndola 3'])
  })

  it('one for the visit; and with no displays yet, one for the visit whatever the setting', () => {
    expect(messageGroups(displays, 'visit')).toEqual([{ key: 'visit', label: null, displayIds: null }])
    expect(messageGroups([], 'type')).toEqual([{ key: 'visit', label: null, displayIds: null }])
  })
})
