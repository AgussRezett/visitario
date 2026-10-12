import { useCallback, useRef, useState } from 'react'
import { ConfirmDialog, type ConfirmOptions } from './ConfirmDialog'

/**
 * `const { confirm, dialog } = useConfirm()`; render `dialog` once and
 * `if (await confirm({ ... }))` wherever the browser's confirm() would go.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false)
    setOptions(next)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const answer = (ok: boolean) => {
    setOpen(false)
    resolver.current?.(ok)
    resolver.current = null
  }

  const dialog = <ConfirmDialog open={open} {...options} onConfirm={() => answer(true)} onCancel={() => answer(false)} />
  return { confirm, dialog }
}
