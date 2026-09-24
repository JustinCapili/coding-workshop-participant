/**
 * Sign-in against springboot-service. The session (JWT, its expiry and the user) lives in
 * sessionStorage so a refresh does not sign the user out, under the same key the mock uses.
 */
import { http, setAuthToken } from '../http'
import { person } from './normalize'

const SESSION_KEY = 'acme-incident-session'

/** POST /auth/login → { token, expiresAt, user } */
export async function login(email, password) {
  const res = await http.post('/auth/login', { email: email.trim(), password })
  const session = { token: res.token, expiresAt: res.expiresAt, user: person(res.user) }
  saveSession(session)
  return session
}

/**
 * POST /auth/register { email, password } → 201 { token, expiresAt, user }.
 * Self-service sign-up for plain employees; the new account comes back already signed in.
 */
export async function register(email, password) {
  const res = await http.post('/auth/register', { email: email.trim(), password })
  const session = { token: res.token, expiresAt: res.expiresAt, user: person(res.user) }
  saveSession(session)
  return session
}

/** Tokens are stateless, so signing out is forgetting the token. */
export async function logout() {
  clearSession()
}

/**
 * Re-checks the stored token with GET /auth/me and picks up any role change.
 * Returns null, and clears the session, when there is no token or the backend rejects it.
 */
export async function refreshSession() {
  const session = getSession()
  if (!session?.token) return null
  setAuthToken(session.token)
  try {
    const me = await http.get('/auth/me')
    const next = { ...session, user: person(me) }
    saveSession(next)
    return next
  } catch (err) {
    if (err.status === 401) {
      clearSession()
      return null
    }
    // Backend unreachable: keep the session rather than signing the user out over a blip.
    return session
  }
}

/**
 * POST /auth/verify-password { password } → 204, or 403 when it is not the current password.
 * The first step of changing a password; changes nothing.
 */
export async function verifyPassword(password) {
  await http.post('/auth/verify-password', { password })
}

/**
 * PUT /auth/password { currentPassword, newPassword } → { token, expiresAt, user }.
 * The backend signs out every other session, so the fresh token replaces the stored one.
 */
export async function changePassword(currentPassword, newPassword) {
  const res = await http.put('/auth/password', { currentPassword, newPassword })
  const session = { token: res.token, expiresAt: res.expiresAt, user: person(res.user) }
  saveSession(session)
  return session
}

/** POST /auth/refresh: swaps a still-valid token for a fresh one. */
export async function renewToken() {
  const session = getSession()
  if (!session?.token) return null
  const res = await http.post('/auth/refresh')
  const next = { token: res.token, expiresAt: res.expiresAt, user: person(res.user) }
  saveSession(next)
  return next
}

export function getSession() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(session) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Session persistence is best-effort.
  }
}

function clearSession() {
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}
