import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXACT_LIMIT, pathCost, shortestPath } from './tsp'

// Small seeded random, so a failure can be replayed.
function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
}

function matrix(n: number, seed: number, symmetric: boolean) {
  const r = rng(seed)
  const m = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.round(r() * 1000)))
  if (symmetric) for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) (m[i] as number[])[j] = (m[j] as number[])[i] as number
  return (i: number, j: number) => (m[i] as number[])[j] as number
}

function bruteForce(n: number, cost: (i: number, j: number) => number, start: number, end?: number) {
  let best = Infinity
  const rest = Array.from({ length: n }, (_, i) => i).filter((i) => i !== start && i !== end)
  const permute = (done: number[], left: number[]) => {
    if (!left.length) {
      best = Math.min(best, pathCost([start, ...done, ...(end === undefined ? [] : [end])], cost))
      return
    }
    left.forEach((x, k) => permute([...done, x], [...left.slice(0, k), ...left.slice(k + 1)]))
  }
  permute([], rest)
  return best
}

describe('shortestPath', () => {
  it('finds the cheapest order, also with one-way costs and a fixed end', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const n = 3 + (seed % 6)
      const cost = matrix(n, seed, seed % 2 === 0)
      const end = seed % 3 === 0 ? n - 1 : undefined
      const { order, total } = shortestPath({ n, cost, start: 0, end })
      expect(order[0]).toBe(0)
      if (end !== undefined) expect(order[order.length - 1]).toBe(end)
      expect(new Set(order).size).toBe(n)
      expect(total).toBe(bruteForce(n, cost, 0, end))
    }
  })

  it('is exact at the limit and fast enough for a phone', () => {
    const cost = matrix(EXACT_LIMIT, 7, false)
    const t = performance.now()
    const { order } = shortestPath({ n: EXACT_LIMIT, cost, start: 0 })
    expect(new Set(order).size).toBe(EXACT_LIMIT)
    expect(performance.now() - t).toBeLessThan(2000)
  })

  it('above the limit it still visits everyone once, start first and end last, better than going to the nearest', () => {
    const n = 25
    const cost = matrix(n, 11, true)
    const { order, total } = shortestPath({ n, cost, start: 3, end: 9 })
    expect(order[0]).toBe(3)
    expect(order[n - 1]).toBe(9)
    expect(new Set(order).size).toBe(n)
    // Nearest neighbour alone, for comparison.
    const greedy = [3]
    const left = new Set(Array.from({ length: n }, (_, i) => i).filter((i) => i !== 3 && i !== 9))
    while (left.size) {
      const here = greedy[greedy.length - 1] as number
      const next = [...left].sort((a, b) => cost(here, a) - cost(here, b))[0] as number
      greedy.push(next)
      left.delete(next)
    }
    greedy.push(9)
    expect(total).toBeLessThanOrEqual(pathCost(greedy, cost))
  })
})

it('the route Edge Function runs this same solver', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
  expect(read('../../supabase/functions/route/tsp.ts')).toBe(read('./tsp.ts'))
})
