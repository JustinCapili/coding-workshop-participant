import { setAuthToken } from '../http'
import {
  changePassword,
  getSession,
  login,
  logout,
  refreshSession,
  register,
  renewToken,
  verifyPassword,
} from './authApi'

const BASE = 'http://api.test/api/springboot-service'
const SESSION_KEY = 'acme-incident-session'

const respond = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: '',
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
})

const backendUser = { employeeId: 'EMP-9', email: 'jane.doe@acme.com', role: 'EMPLOYEE', facultyAdminId: null }
const uiUser = { ...backendUser, name: 'Jane Doe', scope: 'TEAM' }
const tokenResponse = (token = 'jwt-1') => ({ token, expiresAt: '2026-01-01T00:00:00Z', user: backendUser })

const stored = () => JSON.parse(window.sessionStorage.getItem(SESSION_KEY))
const store = (session) => window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))

/** The [method, url, parsed body, headers] of the nth fetch call. */
function sent(n = 0) {
  const [url, init] = global.fetch.mock.calls[n]
  return [init.method, url.replace(BASE, ''), init.body && JSON.parse(init.body), init.headers]
}

const realFetch = global.fetch

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  global.fetch = realFetch
  setAuthToken(null)
  jest.restoreAllMocks()
})

describe('login and register', () => {
  it('login posts the trimmed email and stores the normalized session', async () => {
    global.fetch.mockResolvedValue(respond(200, tokenResponse()))

    const session = await login('  jane.doe@acme.com ', 'secret123')

    expect(sent().slice(0, 3)).toEqual(['POST', '/auth/login', { email: 'jane.doe@acme.com', password: 'secret123' }])
    expect(session).toEqual({ token: 'jwt-1', expiresAt: '2026-01-01T00:00:00Z', user: uiUser })
    expect(stored()).toEqual(session)
  })

  it('login stores nothing when the backend refuses', async () => {
    global.fetch.mockResolvedValue(respond(401, { message: 'Invalid email or password' }))

    await expect(login('a@acme.com', 'bad')).rejects.toMatchObject({ status: 401 })
    expect(stored()).toBeNull()
  })

  it('register posts to /auth/register and signs the new account in', async () => {
    global.fetch.mockResolvedValue(respond(201, tokenResponse('jwt-new')))

    const session = await register(' jane.doe@acme.com', 'longenough')

    expect(sent().slice(0, 3)).toEqual(['POST', '/auth/register', { email: 'jane.doe@acme.com', password: 'longenough' }])
    expect(session.token).toBe('jwt-new')
    expect(stored()).toEqual(session)
  })

  it('still returns the session when sessionStorage refuses to save it', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    global.fetch.mockResolvedValue(respond(200, tokenResponse()))

    await expect(login('jane.doe@acme.com', 'x')).resolves.toMatchObject({ token: 'jwt-1' })
  })
})

describe('logout and getSession', () => {
  it('logout forgets the stored session without calling the backend', async () => {
    store({ token: 't', user: uiUser })
    await logout()
    expect(stored()).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('logout ignores a storage failure', async () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied')
    })
    await expect(logout()).resolves.toBeUndefined()
  })

  it('getSession reads the stored session, or null when it is missing or corrupt', () => {
    expect(getSession()).toBeNull()
    store({ token: 't' })
    expect(getSession()).toEqual({ token: 't' })
    window.sessionStorage.setItem(SESSION_KEY, '{not json')
    expect(getSession()).toBeNull()
  })
})

describe('refreshSession', () => {
  it('is null without calling the backend when there is no stored token', async () => {
    await expect(refreshSession()).resolves.toBeNull()
    store({ user: uiUser })
    await expect(refreshSession()).resolves.toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('re-reads /auth/me with the stored token and picks up the new role', async () => {
    store({ token: 'jwt-1', expiresAt: 'later', user: uiUser })
    global.fetch.mockResolvedValue(respond(200, { ...backendUser, role: 'ENGINEER' }))

    const next = await refreshSession()

    const [method, path, body, headers] = sent()
    expect([method, path, body]).toEqual(['GET', '/auth/me', undefined])
    expect(headers.Authorization).toBe('Bearer jwt-1')
    expect(next).toEqual({ token: 'jwt-1', expiresAt: 'later', user: { ...uiUser, role: 'ENGINEER' } })
    expect(stored()).toEqual(next)
  })

  it('clears the session when the backend rejects the token', async () => {
    store({ token: 'expired', user: uiUser })
    global.fetch.mockResolvedValue(respond(401, { message: 'Token expired' }))

    await expect(refreshSession()).resolves.toBeNull()
    expect(stored()).toBeNull()
  })

  it('keeps the session when the backend cannot be reached', async () => {
    const session = { token: 'jwt-1', user: uiUser }
    store(session)
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(refreshSession()).resolves.toEqual(session)
    expect(stored()).toEqual(session)
  })
})

describe('passwords', () => {
  it('verifyPassword posts the password and resolves to nothing', async () => {
    global.fetch.mockResolvedValue(respond(204))
    await expect(verifyPassword('current')).resolves.toBeUndefined()
    expect(sent().slice(0, 3)).toEqual(['POST', '/auth/verify-password', { password: 'current' }])
  })

  it('verifyPassword rejects with the 403 for a wrong password', async () => {
    global.fetch.mockResolvedValue(respond(403, { message: 'Current password is incorrect' }))
    await expect(verifyPassword('nope')).rejects.toMatchObject({
      status: 403,
      message: 'Current password is incorrect',
    })
  })

  it('changePassword puts both passwords and replaces the stored session with the fresh token', async () => {
    store({ token: 'old', user: uiUser })
    global.fetch.mockResolvedValue(respond(200, tokenResponse('jwt-fresh')))

    const session = await changePassword('old-pass', 'new-pass-1')

    expect(sent().slice(0, 3)).toEqual(['PUT', '/auth/password', { currentPassword: 'old-pass', newPassword: 'new-pass-1' }])
    expect(session).toEqual({ token: 'jwt-fresh', expiresAt: '2026-01-01T00:00:00Z', user: uiUser })
    expect(stored()).toEqual(session)
  })
})

describe('renewToken', () => {
  it('is null without calling the backend when there is no stored token', async () => {
    await expect(renewToken()).resolves.toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('posts /auth/refresh without a body and stores the renewed session', async () => {
    store({ token: 'jwt-1', user: uiUser })
    global.fetch.mockResolvedValue(respond(200, tokenResponse('jwt-2')))

    const next = await renewToken()

    expect(sent().slice(0, 3)).toEqual(['POST', '/auth/refresh', undefined])
    expect(next).toEqual({ token: 'jwt-2', expiresAt: '2026-01-01T00:00:00Z', user: uiUser })
    expect(stored()).toEqual(next)
  })
})
