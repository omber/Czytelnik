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
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function storageSet<T>(username: string, key: string, value: T): void {
  localStorage.setItem(`${PREFIX}:${username}:${key}`, JSON.stringify(value))
}

export function storageRemove(username: string, key: string): void {
  localStorage.removeItem(`${PREFIX}:${username}:${key}`)
}
