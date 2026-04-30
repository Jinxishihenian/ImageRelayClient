import { useContext } from 'react'
import type { AuthSession } from '../types/models'
import { AuthContext } from './AuthContextObject'

export type AuthContextValue = {
  session: AuthSession | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内使用。')
  }

  return context
}
