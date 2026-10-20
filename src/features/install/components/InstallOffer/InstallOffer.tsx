import { useEffect, useState } from 'react'
import { useMatches } from '@tanstack/react-router'
import { shouldOffer } from '@/domain/install'
import { readMemo, rememberDismissal, useInstall } from '@/features/install/state'
import { InstallSheet } from '@/features/install/components/InstallSheet'

/** How long the app is open before the offer: the person sees their screen first. */
const AFTER_MS = 4_000

/**
 * Opens the install guide once by itself, a few seconds into the app: on phones while it
 * runs in the browser, on computers only where one tap installs it. Not during a visit.
 * "Ahora no" rests a week; after three, the guide stays only in the profile.
 */
export function InstallOffer() {
  const { kind, mobile } = useInstall()
  const immersive = useMatches({ select: (m) => m.some((x) => x.staticData.immersive) })
  const [open, setOpen] = useState(false)
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), AFTER_MS)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (waited && !immersive && shouldOffer(kind, mobile, readMemo(), Date.now())) setOpen(true)
    // Opens once per session: later changes (the dialog becoming available) do not reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waited, immersive])

  return (
    <InstallSheet
      open={open && kind !== 'installed'}
      onClose={(reason) => {
        // Closing the dialog fires its own close event too: count the answer once.
        if (!open) return
        if (reason !== 'closed') rememberDismissal(reason === 'done')
        setOpen(false)
      }}
    />
  )
}
