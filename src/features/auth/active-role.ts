import { useMemo, useSyncExternalStore } from 'react'
import { pickActiveRole, type Role } from '@/domain/roles'
import { readLocal, writeLocal } from '@/lib/storage'
import type { Me } from './me'

const KEY = 'visitario.activeRole'
const listeners = new Set<() => void>()

function read(): { companyId: string; role: Role } | null {
  const raw = readLocal(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as { companyId: string; role: Role }
  } catch {
    return null
  }
}

let snapshot = readLocal(KEY)

export function setActiveRole(value: { companyId: string; role: Role }) {
  writeLocal(KEY, JSON.stringify(value))
  snapshot = readLocal(KEY)
  listeners.forEach((l) => l())
}

/** The company and role whose view is open on this device. */
export function useActiveRole(me: Me | null | undefined) {
  const raw = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
  )
  return useMemo(() => {
    void raw
    return me ? pickActiveRole(me.memberships, read()) : null
  }, [me, raw])
}

/** Same as useActiveRole, outside React (route guards). */
export function getActiveRole(me: Me) {
  return pickActiveRole(me.memberships, read())
}
