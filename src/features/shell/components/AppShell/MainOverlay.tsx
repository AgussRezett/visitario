import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MainOverlayContext } from './main-overlay-context'

/**
 * Floats its children over the main content (e.g. "Agregar dirección" on phones) without
 * fixed positioning: the shell stacks this layer in the same grid cell as the content.
 */
export function MainOverlay({ children }: { children: ReactNode }) {
  const slot = useContext(MainOverlayContext)
  return slot ? createPortal(children, slot) : null
}
