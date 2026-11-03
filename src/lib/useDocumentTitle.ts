import { useEffect } from 'react'

const APP = 'Visitario'

/**
 * What the tab says, most precise first: what an open page says (the last one wins), the
 * section the shell knows (it knows the role), the page from the address alone.
 */
const base: Record<'shell' | 'root', string | null> = { shell: null, root: null }
const pages: string[] = []

function apply() {
  const title = pages[pages.length - 1] ?? base.shell ?? base.root
  document.title = title ? `${title} · ${APP}` : APP
}

/** The title for the open section ("Directorio", "Mapa de puntos"…), from the shell or the root. */
export function useBaseTitle(title: string | null, level: 'shell' | 'root') {
  useEffect(() => {
    base[level] = title
    apply()
    return () => {
      base[level] = null
      apply()
    }
  }, [title, level])
}

/**
 * The browser tab says what is open ("Mas Ahorro · Visitario"), more precise than the
 * section; back to the section's title on leaving.
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    pages.push(title)
    apply()
    return () => {
      const i = pages.lastIndexOf(title)
      if (i >= 0) pages.splice(i, 1)
      apply()
    }
  }, [title])
}
