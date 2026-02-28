import { useState, useEffect } from 'react'
import { BookMeta, ChapterMeta } from '../types/book'
import { UserProgress } from '../types/user'
import { storageGet } from '../lib/storage'

export interface BookWithProgress extends BookMeta {
  chapters: ChapterMeta[]
  progress: { chapter: number; page: number } | null
}

const BASE = import.meta.env.BASE_URL

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`)
  return r.json() as Promise<T>
}

export function useBooks(username: string | null) {
  const [books, setBooks] = useState<BookWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!username) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const ids = await fetchJson<string[]>(`${BASE}books/index.json`)
        const progress = storageGet<UserProgress>(username!, 'progress') ?? {}

        const results = await Promise.all(
          ids.map(async id => {
            const [meta, chapters] = await Promise.all([
              fetchJson<BookMeta>(`${BASE}books/${id}/meta.json`),
              fetchJson<ChapterMeta[]>(`${BASE}books/${id}/chapters.json`),
            ])
            return {
              ...meta,
              chapters,
              progress: progress[id] ?? null,
            } as BookWithProgress
          }),
        )

        if (!cancelled) setBooks(results)
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [username])

  return { books, loading, error }
}
