import { useState, useEffect, useCallback } from 'react'
import { storageGet, storageSet } from '../lib/storage'

export function useLocalStorage<T>(
  username: string,
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    return storageGet<T>(username, key) ?? initialValue
  })

  // Re-read when user switches
  useEffect(() => {
    setState(storageGet<T>(username, key) ?? initialValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, key])

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState(prev => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value
        storageSet(username, key, next)
        return next
      })
    },
    [username, key],
  )

  return [state, setValue]
}
