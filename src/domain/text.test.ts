import { describe, expect, it } from 'vitest'
import { tidyText } from './text'

describe('stores are written tidy (same as the database)', () => {
  it.each([
    ['MANUELA PEDRAZA 3526', 'Manuela Pedraza 3526'],
    ['  COGHLAN ', 'Coghlan'],
    ['SOLDADO DE LA INDEPENDENCIA 1065', 'Soldado de la Independencia 1065'],
    ['almacen la esquina s.r.l.', 'Almacen La Esquina S.R.L.'],
    ["AV. O'HIGGINS 2001 4B", "Av. O'Higgins 2001 4B"],
    ['PASAJE JUAN XXIII', 'Pasaje Juan XXIII'],
    ['CABEZÓN   2381', 'Cabezón 2381'],
    ['Gral. José Gervasio Artigas 4965', 'Gral. José Gervasio Artigas 4965'],
    ['VALDENEGR0 2815', 'Valdenegr0 2815'],
    ['', ''],
  ])('%s → %s', (raw, tidy) => expect(tidyText(raw)).toBe(tidy))
})
