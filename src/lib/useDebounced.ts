import { useEffect, useState } from 'react'

/** The value, updated only after it stops changing for `ms`. */
export function useDebounced<T>(value: T, ms = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
