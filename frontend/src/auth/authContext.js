import { createContext } from 'react'

/**
 * { user, token, initializing, sessionExpired, login(email, password), register(email, password),
 *   logout(), refresh() }
 */
export const AuthContext = createContext(null)
