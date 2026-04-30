import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { login as loginRequest } from '../api/client'
import type { AuthSession } from '../types/models'

type AuthContextValue = {
  session: AuthSession | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const STORAGE_KEY = 'image-relay-auth-session'

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStoredSession(): AuthSession | null {
  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as AuthSession
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    typeof window === 'undefined' ? null : loadStoredSession(),
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      async login(username: string, password: string) {
        const nextSession = await loginRequest(username, password)
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession))
        setSession(nextSession)
      },
      logout() {
        window.localStorage.removeItem(STORAGE_KEY)
        setSession(null)
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内使用。')
  }

  return context
}
