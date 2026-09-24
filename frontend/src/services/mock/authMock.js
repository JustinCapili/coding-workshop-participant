/**
 * Mock login / session, used only when VITE_USE_MOCKS=true. Validates against the mock employee
 * directory and issues an opaque fake token. The session is kept in sessionStorage so a refresh
 * does not log the user out.
 */
import { Role } from '../../domain/roles'
import { ApiError } from '../apiError'
import { nameFromEmail } from '../api/normalize'
import { DEMO_PASSWORD, employees } from './fixtures'
import { commit, delay, getDb, nextId } from './mockStore'
import { toPublic } from './employeesMock'

const SESSION_KEY = 'acme-incident-session'

export async function login(email, password) {
  // TODO(backend): POST /auth/login { email, password } -> { token, user }
  await delay(400)
  const normalized = email.trim().toLowerCase()
  const employee = getDb().employees.find((e) => e.email.toLowerCase() === normalized)
  // Seeded accounts share the demo password; self-registered ones keep the password they chose.
  if (!employee || password !== (employee.password ?? DEMO_PASSWORD)) {
    throw new ApiError(401, 'Invalid email or password')
  }
  const session = {
    token: `mock-token-${employee.employeeId}-${Date.now()}`,
    user: toPublic(employee),
  }
  saveSession(session)
  return session
}

/**
 * Self-service sign-up, mirroring POST /auth/register: creates a plain EMPLOYEE on no team and
 * signs them in. The email must be unused by any account, ignoring case.
 */
export async function register(email, password) {
  await delay(400)
  const trimmed = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new ApiError(400, 'email must be a valid email address')
  }
  if (password.length < 8) throw new ApiError(400, 'password must be at least 8 characters')
  const db = getDb()
  if (db.employees.some((e) => e.email.toLowerCase() === trimmed.toLowerCase())) {
    throw new ApiError(409, `An account with email ${trimmed} already exists`)
  }
  const employee = {
    employeeId: nextId('EMP'),
    email: trimmed,
    name: nameFromEmail(trimmed),
    role: Role.EMPLOYEE,
    facultyAdminId: null,
    password,
  }
  db.employees.push(employee)
  commit()
  const session = { token: `mock-token-${employee.employeeId}-${Date.now()}`, user: toPublic(employee) }
  saveSession(session)
  return session
}

/** The signed-in employee's mock record, or a 401 when nobody is signed in. */
function signedInEmployee() {
  const session = getSession()
  const employee = session && getDb().employees.find((e) => e.employeeId === session.user.employeeId)
  if (!employee) throw new ApiError(401, 'Sign in to continue')
  return employee
}

/** Same rule as login: seeded accounts share the demo password until they change it. */
function requireCurrentPassword(employee, password) {
  if (password !== (employee.password ?? DEMO_PASSWORD)) {
    throw new ApiError(403, 'Current password is incorrect')
  }
}

/** Mirrors POST /auth/verify-password: resolves when it is the current password, else a 403. */
export async function verifyPassword(password) {
  await delay(300)
  if (!password) throw new ApiError(400, 'password must not be blank')
  requireCurrentPassword(signedInEmployee(), password)
}

/**
 * Mirrors PUT /auth/password. Mock tokens are not tied to a password, so unlike the backend this
 * does not sign out other sessions; it hands the current session back.
 */
export async function changePassword(currentPassword, newPassword) {
  await delay(400)
  if (!currentPassword) throw new ApiError(400, 'currentPassword must not be blank')
  if (!newPassword) throw new ApiError(400, 'newPassword must not be blank')
  if (newPassword.length < 8) throw new ApiError(400, 'newPassword must be at least 8 characters')
  if (newPassword === currentPassword) {
    throw new ApiError(400, 'newPassword must differ from the current password')
  }
  const employee = signedInEmployee()
  requireCurrentPassword(employee, currentPassword)
  employee.password = newPassword
  commit()
  return getSession()
}

export async function logout() {
  // TODO(backend): POST /auth/logout (if the backend keeps server-side sessions)
  clearSession()
}

/** Re-read the current user (picks up role changes such as a Create Engineer promotion). */
export async function refreshSession() {
  const session = getSession()
  if (!session) return null
  const employee = getDb().employees.find((e) => e.employeeId === session.user.employeeId)
  if (!employee) {
    clearSession()
    return null
  }
  const next = { ...session, user: toPublic(employee) }
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

/** The demo accounts surfaced as one-click chips on the login card. */
const DEMO_EMAILS = ['alice@acme.com', 'bob@acme.com', 'frank@acme.com', 'admin@acme.com']

export async function listDemoAccounts() {
  return {
    accounts: DEMO_EMAILS.map((email) => employees.find((e) => e.email === email)).filter(Boolean),
    password: DEMO_PASSWORD,
  }
}

/** Mock tokens never expire, so renewing just hands the current session back. */
export async function renewToken() {
  return getSession()
}
