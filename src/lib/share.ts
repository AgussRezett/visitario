import { useCallback, useEffect, useRef, useState } from 'react'

/** Copies text; falls back to a hidden textarea where the Clipboard API is missing. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

/** Opens the phone's share sheet (WhatsApp, etc.); false when sharing is not available. */
export async function share(data: { text?: string; title?: string; files?: File[] }) {
  if (!navigator.share) return false
  if (data.files?.length && !navigator.canShare?.({ files: data.files })) {
    const { files: _ignored, ...rest } = data
    void _ignored
    data = rest
  }
  try {
    await navigator.share(data)
    return true
  } catch {
    return false
  }
}

export const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'

/** Copy with a short "Copiado" confirmation for the button that did it. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = useCallback(async (key: string, text: string) => {
    if (await copyText(text)) {
      setCopied(key)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(null), 2000)
    }
  }, [])
  return { copied, copy }
}
