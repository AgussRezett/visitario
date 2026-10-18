// The order to visit a set of points with the least total cost (km or minutes), as an open
// path that starts at a fixed point and may end at a fixed one. The cost may be asymmetric
// (one-way streets). No imports: the route Edge Function runs this same file
// (supabase/functions/route/tsp.ts is a copy, checked by a test).

/** Exact up to this many points (Held–Karp, a few ms on a phone); above it, local search. */
export const EXACT_LIMIT = 16

export interface PathRequest {
  /** How many points: 0 … n-1. */
  n: number
  /** Cost of going from i to j. */
  cost: (i: number, j: number) => number
  /** The point the path starts at. */
  start: number
  /** The point the path must end at, if any. */
  end?: number
}

/** Visiting order of all points (start first, end last), and its total cost. */
export function shortestPath({ n, cost, start, end }: PathRequest): { order: number[]; total: number } {
  if (n <= 0) return { order: [], total: 0 }
  if (n === 1) return { order: [start], total: 0 }
  const fixedEnd = end !== undefined && end !== start ? end : undefined
  const order = n <= EXACT_LIMIT ? exact(n, cost, start, fixedEnd) : improve(nearest(n, cost, start, fixedEnd), cost, fixedEnd !== undefined)
  return { order, total: pathCost(order, cost) }
}

export function pathCost(order: readonly number[], cost: (i: number, j: number) => number): number {
  let total = 0
  for (let k = 1; k < order.length; k++) total += cost(order[k - 1] as number, order[k] as number)
  return total
}

/** Held–Karp: best[mask][j] = cheapest path from start through mask ending at j. */
function exact(n: number, cost: (i: number, j: number) => number, start: number, end: number | undefined): number[] {
  const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== start)
  const m = others.length
  const size = 1 << m
  const best = new Float64Array(size * m).fill(Infinity)
  const from = new Int8Array(size * m).fill(-1)
  const c = (i: number, j: number) => cost(others[i] as number, others[j] as number)
  for (let j = 0; j < m; j++) best[(1 << j) * m + j] = cost(start, others[j] as number)
  for (let mask = 1; mask < size; mask++) {
    for (let j = 0; j < m; j++) {
      if (!(mask & (1 << j))) continue
      const here = best[mask * m + j] as number
      if (here === Infinity) continue
      for (let k = 0; k < m; k++) {
        if (mask & (1 << k)) continue
        const next = mask | (1 << k)
        const value = here + c(j, k)
        if (value < (best[next * m + k] as number)) {
          best[next * m + k] = value
          from[next * m + k] = j
        }
      }
    }
  }
  const full = size - 1
  let last = end === undefined ? -1 : others.indexOf(end)
  if (last === -1) {
    let cheapest = Infinity
    for (let j = 0; j < m; j++) {
      const value = best[full * m + j] as number
      if (value < cheapest) {
        cheapest = value
        last = j
      }
    }
  }
  const order: number[] = []
  let mask = full
  while (last !== -1) {
    order.push(others[last] as number)
    const prev = from[mask * m + last] as number
    mask ^= 1 << last
    last = prev
  }
  return [start, ...order.reverse()]
}

/** Nearest neighbour from the start; the fixed end goes last. */
function nearest(n: number, cost: (i: number, j: number) => number, start: number, end: number | undefined): number[] {
  const order = [start]
  const left = new Set(Array.from({ length: n }, (_, i) => i).filter((i) => i !== start && i !== end))
  while (left.size) {
    const here = order[order.length - 1] as number
    let pick = -1
    let cheapest = Infinity
    for (const i of left) {
      const value = cost(here, i)
      if (value < cheapest) {
        cheapest = value
        pick = i
      }
    }
    order.push(pick)
    left.delete(pick)
  }
  if (end !== undefined) order.push(end)
  return order
}

/**
 * Local search until nothing helps: reverse a stretch (2-opt) or move a run of 1–3 stops
 * elsewhere (Or-opt). Costs are recomputed in full, so one-way streets are respected.
 */
function improve(initial: number[], cost: (i: number, j: number) => number, fixedEnd: boolean): number[] {
  let order = initial
  let total = pathCost(order, cost)
  const lastMovable = order.length - (fixedEnd ? 2 : 1)
  const tryOrder = (candidate: number[]) => {
    const value = pathCost(candidate, cost)
    if (value + 1e-9 < total) {
      order = candidate
      total = value
      return true
    }
    return false
  }
  let improved = true
  while (improved) {
    improved = false
    for (let i = 1; i < lastMovable && !improved; i++) {
      for (let j = i + 1; j <= lastMovable && !improved; j++) {
        improved = tryOrder([...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)])
      }
    }
    for (let len = 1; len <= 3 && !improved; len++) {
      for (let i = 1; i + len - 1 <= lastMovable && !improved; i++) {
        const run = order.slice(i, i + len)
        const rest = [...order.slice(0, i), ...order.slice(i + len)]
        const lastSlot = rest.length - (fixedEnd ? 1 : 0)
        for (let at = 1; at <= lastSlot && !improved; at++) {
          if (at === i) continue
          improved = tryOrder([...rest.slice(0, at), ...run, ...rest.slice(at)])
        }
      }
    }
  }
  return order
}
