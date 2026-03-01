const PREFIX = 'polish-reader'
const USERS_KEY = `${PREFIX}:_users`

export function getUsers(): string[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function saveUsers(users: string[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function storageGet<T>(username: string, key: string): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}:${username}:${key}`)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch (e) {
    console.warn(`[storage] Failed to parse "${key}":`, e)
    return null
  }
}

export function storageSet<T>(username: string, key: string, value: T): void {
  try {
    localStorage.setItem(`${PREFIX}:${username}:${key}`, JSON.stringify(value))
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      console.warn('[storage] localStorage quota exceeded for key:', key)
      window.dispatchEvent(new CustomEvent('storage-quota-exceeded', { detail: { key } }))
    }
  }
}

export function storageRemove(username: string, key: string): void {
  localStorage.removeItem(`${PREFIX}:${username}:${key}`)
}

export function exportUserData(username: string): void {
  const data = {
    version: 1,
    username,
    progress: storageGet(username, 'progress') ?? {},
    vocab: storageGet(username, 'vocab') ?? [],
    stats: storageGet(username, 'stats') ?? {},
    settings: storageGet(username, 'settings') ?? {},
  }
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `czytelnik-${username}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function importUserData(
  username: string,
  json: string,
): void {
  const data = JSON.parse(json) as {
    version: number
    progress: unknown
    vocab: unknown
    stats: unknown
    settings: unknown
  }
  if (data.version !== 1) throw new Error('Неверная версия файла')
  storageSet(username, 'progress', data.progress)
  storageSet(username, 'vocab', data.vocab)
  storageSet(username, 'stats', data.stats)
  storageSet(username, 'settings', data.settings)
}
