import { createContext } from 'react'

/** The layer over the main content, owned by the app shell. */
export const MainOverlayContext = createContext<HTMLElement | null>(null)
