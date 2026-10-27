import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useOnline } from '@/lib/online'
import { verifyStore } from '@/features/workday/api/geocode'

// Asked once per store while the app is open; what failed for lack of signal is asked again.
const asked = new Set<string>()
let queue: Promise<void> = Promise.resolve()
let waiting = 0
let changed = false

const refresh = (qc: QueryClient) =>
  Promise.all([qc.invalidateQueries({ queryKey: ['stores'] }), qc.invalidateQueries({ queryKey: ['workday'] }), qc.invalidateQueries({ queryKey: ['team'] })])

/**
 * Every store on screen without a location gets located by itself, one at a time (the
 * geocoder allows about two requests a second), and the screens refresh when the queue ends.
 * Nobody has to tap "Verificar": not the activador who added it, not the supervisor.
 */
export function useAutoVerify(stores: readonly { id: string; locationStatus: string }[]) {
  const qc = useQueryClient()
  const online = useOnline()
  const ids = stores.filter((s) => s.id && s.locationStatus === 'unverified').map((s) => s.id)
  const signature = ids.join(',')

  useEffect(() => {
    if (!online) return
    for (const id of ids) {
      if (asked.has(id)) continue
      asked.add(id)
      waiting++
      queue = queue.then(async () => {
        try {
          const status = await verifyStore(id)
          if (status === 'verified' || status === 'approximate') changed = true
        } catch {
          asked.delete(id) // no signal or the service failed: next time
        }
        waiting--
        if (waiting === 0 && changed) {
          changed = false
          await refresh(qc)
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ids are compared by their signature
  }, [signature, online, qc])
}
