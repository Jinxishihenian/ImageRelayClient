import { createContext } from 'react'
import type { AuthContextValue } from './useAuth'

export const AuthContext = createContext<AuthContextValue | null>(null)
