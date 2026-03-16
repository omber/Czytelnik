import { useState, useEffect } from 'react'
import { VocabEntry } from '../types/user'
import { storageGet, storageSet } from '../lib/storage'

const KEY = 'vocab'
const FOREVER_REVIEW_DATE = '9999-12-31'

function nextReviewDate(box: 1 | 2 | 3 | 4 | 5): string {
  if (box === 5) return FOREVER_REVIEW_DATE
  const days = box === 1 ? 1 : box === 2 ? 3 : box === 3 ? 7 : 14
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0] // YYYY-MM-DD
}

function normalizeEntry(entry: VocabEntry): VocabEntry {
  const normalizedBox = Math.min(Math.max(entry.box, 1), 5) as 1 | 2 | 3 | 4 | 5
  const normalizedNextReview =
    normalizedBox === 5
      ? FOREVER_REVIEW_DATE
      : entry.nextReview || nextReviewDate(normalizedBox)

  return {
    ...entry,
    box: normalizedBox,
    nextReview: normalizedNextReview,
  }
}

export function useVocab(username: string) {
  const [entries, setEntries] = useState<VocabEntry[]>(() =>
    (storageGet<VocabEntry[]>(username, KEY) ?? []).map(normalizeEntry),
  )

  // Re-sync when user switches profile
  useEffect(() => {
    setEntries((storageGet<VocabEntry[]>(username, KEY) ?? []).map(normalizeEntry))
  }, [username])

  function add(
    token: { lemma: string; surface: string; pos: string },
    translation: string,
    context: {
      bookId: string
      chapter: number
      sentenceText: string
      sentenceTranslation: string
    },
  ) {
    setEntries(prev => {
      const existing = prev.find(
        e => e.lemma.toLowerCase() === token.lemma.toLowerCase(),
      )
      if (existing) {
        const hasCtx = existing.contexts.some(
          c =>
            c.bookId === context.bookId &&
            c.sentenceText === context.sentenceText,
        )
        if (!hasCtx) {
          const updated = prev.map(e =>
            e === existing
              ? { ...e, contexts: [...e.contexts, context] }
              : e,
          )
          storageSet(username, KEY, updated)
          return updated
        }
        return prev
      }
      const entry: VocabEntry = {
        lemma: token.lemma,
        surface: token.surface,
        pos: token.pos,
        translation,
        box: 1,
        addedAt: new Date().toISOString(),
        nextReview: new Date().toISOString().split('T')[0],
        contexts: [context],
      }
      const updated = [...prev, entry]
      storageSet(username, KEY, updated)
      return updated
    })
  }

  function remove(lemma: string) {
    setEntries(prev => {
      const updated = prev.filter(
        e => e.lemma.toLowerCase() !== lemma.toLowerCase(),
      )
      storageSet(username, KEY, updated)
      return updated
    })
  }

  function review(lemma: string, correct: boolean) {
    setEntries(prev => {
      const updated = prev.map(e => {
        if (e.lemma.toLowerCase() !== lemma.toLowerCase()) return e
        const newBox = (correct ? Math.min(e.box + 1, 5) : 1) as 1 | 2 | 3 | 4 | 5
        return { ...e, box: newBox, nextReview: nextReviewDate(newBox) }
      })
      storageSet(username, KEY, updated)
      return updated
    })
  }

  function getDue(): VocabEntry[] {
    const today = new Date().toISOString().split('T')[0]
    return entries.filter(e => e.nextReview <= today)
  }

  function isInVocab(lemma: string): boolean {
    return entries.some(e => e.lemma.toLowerCase() === lemma.toLowerCase())
  }

  return { entries, add, remove, review, getDue, isInVocab }
}
