import { useState, useEffect } from 'react'
import { VocabEntry } from '../types/user'
import { storageGet, storageSet } from '../lib/storage'

const KEY = 'vocab'

function nextReviewDate(box: 1 | 2 | 3): string {
  const days = box === 1 ? 1 : box === 2 ? 3 : 7
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0] // YYYY-MM-DD
}

export function useVocab(username: string) {
  const [entries, setEntries] = useState<VocabEntry[]>(() =>
    storageGet<VocabEntry[]>(username, KEY) ?? [],
  )

  // Re-sync when user switches profile
  useEffect(() => {
    setEntries(storageGet<VocabEntry[]>(username, KEY) ?? [])
  }, [username])

  function _save(updated: VocabEntry[]) {
    storageSet(username, KEY, updated)
    setEntries(updated)
  }

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
    const all = storageGet<VocabEntry[]>(username, KEY) ?? []
    const existing = all.find(
      e => e.lemma.toLowerCase() === token.lemma.toLowerCase(),
    )
    if (existing) {
      const hasCtx = existing.contexts.some(
        c =>
          c.bookId === context.bookId &&
          c.sentenceText === context.sentenceText,
      )
      if (!hasCtx) {
        existing.contexts = [...existing.contexts, context]
        _save([...all])
      }
      return
    }
    const entry: VocabEntry = {
      lemma: token.lemma,
      surface: token.surface,
      pos: token.pos,
      translation,
      box: 1,
      addedAt: new Date().toISOString(),
      nextReview: nextReviewDate(1),
      contexts: [context],
    }
    _save([...all, entry])
  }

  function remove(lemma: string) {
    const all = storageGet<VocabEntry[]>(username, KEY) ?? []
    _save(all.filter(e => e.lemma.toLowerCase() !== lemma.toLowerCase()))
  }

  function review(lemma: string, correct: boolean) {
    const all = storageGet<VocabEntry[]>(username, KEY) ?? []
    const updated = all.map(e => {
      if (e.lemma.toLowerCase() !== lemma.toLowerCase()) return e
      const newBox = (correct ? Math.min(e.box + 1, 3) : 1) as 1 | 2 | 3
      return { ...e, box: newBox, nextReview: nextReviewDate(newBox) }
    })
    _save(updated)
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
