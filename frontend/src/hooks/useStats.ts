import { useLocalStorage } from './useLocalStorage'
import { UserStats } from '../types/user'

const DEFAULT: UserStats = {
  totalReadingSeconds: 0,
  uniqueWordsEncountered: [],
  sessionsLog: [],
}

export function useStats(username: string) {
  const [stats, setStats] = useLocalStorage<UserStats>(username, 'stats', DEFAULT)

  function logSession(bookId: string, seconds: number) {
    if (seconds < 5) return
    const date = new Date().toISOString().slice(0, 10)
    setStats(s => ({
      ...s,
      totalReadingSeconds: s.totalReadingSeconds + seconds,
      sessionsLog: [...s.sessionsLog, { date, seconds, bookId }],
    }))
  }

  function addUniqueWords(lemmas: string[]) {
    setStats(s => {
      const existing = new Set(s.uniqueWordsEncountered)
      const newOnes = lemmas.filter(l => l && !existing.has(l))
      if (newOnes.length === 0) return s
      return {
        ...s,
        uniqueWordsEncountered: [...s.uniqueWordsEncountered, ...newOnes],
      }
    })
  }

  return { stats, logSession, addUniqueWords }
}
