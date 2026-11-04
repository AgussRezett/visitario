import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { moveStop } from '@/domain/route'

/** Near the top or bottom of the screen, a dragged stop scrolls the list. */
const EDGE = 72
const SPEED = 10

/**
 * Reordering a list by dragging a handle (finger or mouse) or with the arrow keys on it.
 * Every swap is reported at once, so whatever follows the order (the map) updates live.
 */
export function useDragOrder(ids: readonly string[], onReorder: ((ids: string[], moved: string) => void) | undefined) {
  const items = useRef(new Map<string, HTMLElement>())
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null)
  const state = useRef({ id: '', startY: 0, lastY: 0, startScroll: 0, scroller: null as HTMLElement | null, frame: 0, expected: '' })
  const order = useRef(ids)
  order.current = ids

  const scrollTop = () => state.current.scroller?.scrollTop ?? window.scrollY

  // Where the dragged stop is now, and a swap when it passes the middle of a neighbour.
  const update = () => {
    const s = state.current
    if (!s.id) return
    const dy = s.lastY - s.startY + (scrollTop() - s.startScroll)
    setDrag({ id: s.id, dy })
    if (!onReorder || (s.expected && s.expected !== order.current.join())) return // the last swap is not drawn yet
    s.expected = ''
    const list = order.current
    const i = list.indexOf(s.id)
    const me = items.current.get(s.id)
    if (!me || i < 0) return
    const center = me.offsetTop + dy + me.offsetHeight / 2
    const next = items.current.get(list[i + 1] ?? '')
    const prev = items.current.get(list[i - 1] ?? '')
    let to = -1
    let shift = 0
    if (next && center > next.offsetTop + next.offsetHeight / 2) {
      to = i + 1
      shift = next.offsetTop + next.offsetHeight - (me.offsetTop + me.offsetHeight)
    } else if (prev && center < prev.offsetTop + prev.offsetHeight / 2) {
      to = i - 1
      shift = prev.offsetTop - me.offsetTop
    }
    if (to < 0) return
    s.startY += shift
    const moved = moveStop(list, i, to)
    s.expected = moved.join()
    onReorder(moved, s.id)
    setDrag({ id: s.id, dy: s.lastY - s.startY + (scrollTop() - s.startScroll) })
  }

  // While held near an edge, the list keeps scrolling (and the stop keeps moving with it).
  const tick = () => {
    const s = state.current
    if (!s.id) return
    const top = s.scroller ? s.scroller.getBoundingClientRect().top : 0
    const bottom = s.scroller ? s.scroller.getBoundingClientRect().bottom : window.innerHeight
    const step = s.lastY < top + EDGE ? -SPEED : s.lastY > bottom - EDGE ? SPEED : 0
    if (step) {
      if (s.scroller) s.scroller.scrollTop += step
      else window.scrollBy(0, step)
      update()
    }
    s.frame = requestAnimationFrame(tick)
  }

  const end = () => {
    cancelAnimationFrame(state.current.frame)
    state.current.id = ''
    setDrag(null)
  }
  useEffect(() => () => cancelAnimationFrame(state.current.frame), [])

  const handle = (id: string, name: string) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (!onReorder || (e.pointerType === 'mouse' && e.button !== 0)) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const scroller = scrollParent(e.currentTarget)
      state.current = { id, startY: e.clientY, lastY: e.clientY, startScroll: scroller?.scrollTop ?? window.scrollY, scroller, frame: 0, expected: '' }
      setDrag({ id, dy: 0 })
      state.current.frame = requestAnimationFrame(tick)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (state.current.id !== id) return
      state.current.lastY = e.clientY
      update()
    },
    onPointerUp: end,
    onPointerCancel: end,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (!onReorder || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
      e.preventDefault()
      const i = order.current.indexOf(id)
      const to = e.key === 'ArrowUp' ? i - 1 : i + 1
      if (to < 0 || to >= order.current.length) return
      onReorder(moveStop(order.current, i, to), id)
    },
    'aria-label': `Mover ${name}`,
  })

  const ref = (id: string) => (el: HTMLElement | null) => {
    if (el) items.current.set(id, el)
    else items.current.delete(id)
  }

  return { drag, handle, ref }
}

/** The nearest box that scrolls (the app scrolls inside its main area, not the page). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY
    if ((y === 'auto' || y === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}
