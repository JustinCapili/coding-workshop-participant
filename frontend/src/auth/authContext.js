import { createContext } from 'react'

/**
 * { user, token, initializing, sessionExpired, signedOut, login(email, password),
 *   register(email, password), logout(), refresh(), changePassword(currentPassword, newPassword) }
 */
export const AuthContext = createContext(null)
