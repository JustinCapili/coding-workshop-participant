import { useCallback, useEffect, useMemo, useState } from 'react'
import * as authService from '../services/authService'
import { setAuthToken, setUnauthorizedHandler } from '../services/http'
import { AuthContext } from './authContext'

/** Renew the token once less than this much of its life is left. */
const RENEW_WITHIN_MS = 30 * 60 * 1000

function msUntilRenewal(session) {
  if (!session?.expiresAt) return null
  return new Date(session.expiresAt).getTime() - Date.now() - RENEW_WITHIN_MS
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  const apply = useCallback((next) => {
    setAuthToken(next?.token ?? null)
    setSession(next)
  }, [])

  // Any 401 from the backend (other than a failed sign-in) means the token is no longer good:
  // drop the session, which sends RequireAuth to /login, where the expiry notice is shown.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      authService.logout()
      apply(null)
      setSessionExpired(true)
    })
    return () => setUnauthorizedHandler(null)
  }, [apply])

  // Restore a session on first load so a refresh does not bounce to /login.
  useEffect(() => {
    let cancelled = false
    authService
      .refreshSession()
      .then((restored) => {
        if (!cancelled) apply(restored)
      })
      .finally(() => {
        if (!cancelled) setInitializing(false)
      })
    return () => {
      cancelled = true
    }
  }, [apply])

  const renew = useCallback(async () => {
    try {
      const next = await authService.renewToken()
      if (next) apply(next)
    } catch {
      // A 401 is handled by the unauthorized handler; anything else retries on the next focus.
    }
  }, [apply])

  // Keep an active session alive: renew shortly before expiry, and on focus if the tab slept
  // through the timer.
  useEffect(() => {
    const wait = msUntilRenewal(session)
    if (wait === null) return undefined
    const timer = window.setTimeout(renew, Math.max(wait, 0))
    const onFocus = () => {
      if ((msUntilRenewal(session) ?? 1) <= 0) renew()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [session, renew])

  const login = useCallback(
    async (email, password) => {
      const next = await authService.login(email, password)
      apply(next)
      setSessionExpired(false)
      return next.user
    },
    [apply],
  )

  const register = useCallback(
    async (email, password) => {
      const next = await authService.register(email, password)
      apply(next)
      setSessionExpired(false)
      return next.user
    },
    [apply],
  )

  const logout = useCallback(async () => {
    await authService.logout()
    apply(null)
    setSessionExpired(false)
  }, [apply])

  const refresh = useCallback(async () => {
    const next = await authService.refreshSession()
    apply(next)
    return next?.user ?? null
  }, [apply])

  // The backend retires every earlier token on a password change, so switch to the one it returns.
  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const next = await authService.changePassword(currentPassword, newPassword)
      apply(next)
      return next.user
    },
    [apply],
  )

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      initializing,
      sessionExpired,
      login,
      register,
      logout,
      refresh,
      changePassword,
    }),
    [session, initializing, sessionExpired, login, register, logout, refresh, changePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
