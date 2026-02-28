import { useState, useEffect } from 'react'

export interface DictEntry {
  ru: string
  pos: string
}

type Dictionary = Record<string, DictEntry>

const BASE = import.meta.env.BASE_URL
let cache: Dictionary | null = null
let promise: Promise<Dictionary> | null = null

function fetchDictionary(): Promise<Dictionary> {
  if (cache) return Promise.resolve(cache)
  if (!promise) {
    promise = fetch(`${BASE}dictionary.json`)
      .then(r => (r.ok ? r.json() : {}))
      .then((d: Dictionary) => {
        cache = d
        return d
      })
      .catch(() => {
        promise = null
        return {}
      })
  }
  return promise
}

export function useDictionary() {
  const [dict, setDict] = useState<Dictionary>(cache ?? {})

  useEffect(() => {
    if (cache) return
    fetchDictionary().then(setDict)
  }, [])

  function lookup(lemma: string): string {
    return dict[lemma.toLowerCase()]?.ru ?? ''
  }

  return { lookup }
}
