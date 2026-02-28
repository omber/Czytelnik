import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { getUsers, saveUsers } from '../lib/storage'

interface UserContextType {
  currentUser: string | null
  setCurrentUser: (user: string) => void
  logout: () => void
  users: string[]
  createUser: (name: string) => boolean
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<string | null>(() => {
    return localStorage.getItem('polish-reader:current-user')
  })
  const [users, setUsers] = useState<string[]>(getUsers)

  const setCurrentUser = useCallback((user: string) => {
    localStorage.setItem('polish-reader:current-user', user)
    setCurrentUserState(user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('polish-reader:current-user')
    setCurrentUserState(null)
  }, [])

  const createUser = useCallback(
    (name: string): boolean => {
      const trimmed = name.trim()
      if (!trimmed || users.includes(trimmed)) return false
      const updated = [...users, trimmed]
      saveUsers(updated)
      setUsers(updated)
      return true
    },
    [users],
  )

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, logout, users, createUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be inside UserProvider')
  return ctx
}
