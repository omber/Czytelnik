import { useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { UserProgress } from '../types/user'

export function useProgress(username: string) {
  const [progress, setProgress] = useLocalStorage<UserProgress>(username, 'progress', {})

  const savePosition = useCallback(
    (bookId: string, chapter: number, page: number) => {
      setProgress(prev => ({
        ...prev,
        [bookId]: { chapter, page },
      }))
    },
    [setProgress],
  )

  return { progress, savePosition }
}
