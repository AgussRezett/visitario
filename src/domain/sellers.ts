// Which seller of the catalog a person is, loaded by name before they joined Visitario.
// The same rule the database follows when they join with the seller role (link_seller):
// full name, then first name, then first name + start of the surname, only if one fits.

interface Loaded {
  id: number
  name: string
  personId: string | null
  active: boolean
}

/** As the database compares names: lowercase, without accents nor punctuation, single spaces. */
export const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,;:]/g, ' ').replace(/\s+/g, ' ').trim()

/** The sellers still without a user: the ones a new person can be. */
export const freeSellers = <T extends Loaded>(sellers: readonly T[]) => sellers.filter((s) => s.personId === null && s.active)

export function sellerFor<T extends Loaded>(first: string, last: string, sellers: readonly T[]): T | null {
  const free = freeSellers(sellers)
  const [f, l] = [normalizeName(first), normalizeName(last)]
  const full = normalizeName(`${first} ${last}`)
  const exact = free.find((s) => normalizeName(s.name) === full) ?? free.find((s) => normalizeName(s.name) === f)
  if (exact) return exact
  const prefix = free.filter((s) => {
    const n = normalizeName(s.name)
    return n.startsWith(`${f} `) && n.length > f.length + 1 && l.startsWith(n.slice(f.length + 1))
  })
  return prefix.length === 1 ? (prefix[0] ?? null) : null
}
