export interface UserProgress {
  [bookId: string]: {
    chapter: number
    page: number
    lastOpenedAt?: string
  }
}

export interface VocabEntry {
  lemma: string
  surface: string
  pos: string
  translation: string
  box: 1 | 2 | 3
  addedAt: string
  nextReview: string
  contexts: Array<{
    bookId: string
    chapter: number
    sentenceText: string
    sentenceTranslation: string
  }>
}

export interface UserStats {
  totalReadingSeconds: number
  uniqueWordsEncountered: string[]
  sessionsLog: Array<{
    date: string
    seconds: number
    bookId: string
  }>
}

export interface UserSettings {
  ttsSpeed: number
  fontSize: 'sm' | 'base' | 'lg' | 'xl'
}
