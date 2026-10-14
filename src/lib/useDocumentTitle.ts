import { useEffect } from 'react'

const APP = 'Visitario'

/** The browser tab says where you are ("Mas Ahorro · Visitario"); back to "Visitario" on leaving. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    document.title = `${title} · ${APP}`
    return () => {
      document.title = APP
    }
  }, [title])
}
