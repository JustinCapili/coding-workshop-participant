import { Role } from '../../domain/roles'
import { ApiError } from '../apiError'
import { seededUser, signInAs } from '../../test/renderApp'
import {
  changePassword,
  getSession,
  listDemoAccounts,
  login,
  logout,
  refreshSession,
  register,
  renewToken,
  verifyPassword,
} from './authMock'
import { DEMO_PASSWORD } from './fixtures'
import { getDb } from './mockStore'

const SESSION_KEY = 'acme-incident-session'
const stored = () => JSON.parse(window.sessionStorage.getItem(SESSION_KEY))
const persistedEmployees = () =>
  JSON.parse(window.localStorage.getItem('acme-incident-mock-db-v1')).employees

afterEach(() => {
  jest.restoreAllMocks()
})

describe('login', () => {
  it('signs a seeded account in with the demo password and stores the session', async () => {
    const session = await login('alice@acme.com', DEMO_PASSWORD)

    expect(session.token).toMatch(/^mock-token-EMP-001-\d+$/)
    expect(session.user).toEqual(seededUser('alice@acme.com'))
    expect(stored()).toEqual(session)
  })

  it('ignores case and surrounding spaces in the email', async () => {
    const session = await login('  Alice@ACME.com ', DEMO_PASSWORD)
    expect(session.user.employeeId).toBe('EMP-001')
  })

  it.each([
    ['a wrong password', 'alice@acme.com', 'wrong'],
    ['an unknown email', 'nobody@acme.com', DEMO_PASSWORD],
  ])('refuses %s with a 401 and stores nothing', async (_case, email, password) => {
    const err = await login(email, password).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 401, message: 'Invalid email or password' })
    expect(stored()).toBeNull()
  })

  it('still signs in when sessionStorage refuses to save the session', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    await expect(login('bob@acme.com', DEMO_PASSWORD)).resolves.toMatchObject({
      user: { employeeId: 'ENG-001' },
    })
  })
})

describe('register', () => {
  it('creates a teamless EMPLOYEE, signs them in and persists the account', async () => {
    const session = await register(' new.person@acme.inc ', 'longenough')

    expect(session.user).toEqual({
      employeeId: expect.stringMatching(/^EMP-\d+$/),
      email: 'new.person@acme.inc',
      name: 'New Person',
      role: Role.EMPLOYEE,
      scope: undefined,
      facultyAdminId: null,
    })
    expect(session.token).toMatch(new RegExp(`^mock-token-${session.user.employeeId}-\\d+$`))
    expect(stored()).toEqual(session)
    expect(persistedEmployees().map((e) => e.email)).toContain('new.person@acme.inc')
  })

  it('keeps the chosen password: it signs in with it and not with the demo password', async () => {
    await register('new.person@acme.inc', 'my-own-password')
    await logout()

    await expect(login('new.person@acme.inc', DEMO_PASSWORD)).rejects.toMatchObject({ status: 401 })
    await expect(login('NEW.person@acme.inc', 'my-own-password')).resolves.toMatchObject({
      user: { email: 'new.person@acme.inc' },
    })
  })

  it.each(['new.person@acme.com', 'new.person@sub.acme.inc', 'new.person@acme.inc.example.com'])(
    'rejects %p, which is not an @acme.inc address, with a 400',
    async (email) => {
      const count = getDb().employees.length
      await expect(register(email, 'longenough')).rejects.toMatchObject({
        status: 400,
        message: 'email must be an @acme.inc address',
      })
      expect(getDb().employees).toHaveLength(count)
    },
  )

  it.each(['not-an-email', 'a@b', 'with space@acme.com', ''])(
    'rejects the email %p with a 400',
    async (email) => {
      await expect(register(email, 'longenough')).rejects.toMatchObject({
        status: 400,
        message: 'email must be a valid email address',
      })
    },
  )

  it('rejects a password under 8 characters with a 400', async () => {
    await expect(register('new@acme.inc', 'short')).rejects.toMatchObject({
      status: 400,
      message: 'password must be at least 8 characters',
    })
  })

  it('rejects an email already in use, ignoring case, with a 409', async () => {
    const count = getDb().employees.length
    await expect(register('ADMIN@acme.inc', 'longenough')).rejects.toMatchObject({
      status: 409,
      message: 'An account with email ADMIN@acme.inc already exists',
    })
    expect(getDb().employees).toHaveLength(count)
    expect(stored()).toBeNull()
  })
})

describe('logout and getSession', () => {
  it('logout forgets the session', async () => {
    signInAs('alice@acme.com')
    await logout()
    expect(getSession()).toBeNull()
  })

  it('logout ignores a storage failure', async () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied')
    })
    await expect(logout()).resolves.toBeUndefined()
  })

  it('getSession is null for a corrupt stored session', () => {
    window.sessionStorage.setItem(SESSION_KEY, '{oops')
    expect(getSession()).toBeNull()
  })
})

describe('refreshSession', () => {
  it('is null when nobody is signed in', async () => {
    await expect(refreshSession()).resolves.toBeNull()
  })

  it('picks up a change to the signed-in employee, such as a promotion', async () => {
    signInAs('alice@acme.com')
    const alice = getDb().employees.find((e) => e.employeeId === 'EMP-001')
    alice.role = Role.ENGINEER

    const next = await refreshSession()

    expect(next.token).toBe('mock-token-EMP-001')
    expect(next.user.role).toBe(Role.ENGINEER)
    expect(stored()).toEqual(next)
  })

  it('signs out an employee who no longer exists', async () => {
    signInAs('alice@acme.com')
    getDb().employees = getDb().employees.filter((e) => e.employeeId !== 'EMP-001')

    await expect(refreshSession()).resolves.toBeNull()
    expect(stored()).toBeNull()
  })
})

describe('verifyPassword', () => {
  it('resolves for the current password', async () => {
    signInAs('bob@acme.com')
    await expect(verifyPassword(DEMO_PASSWORD)).resolves.toBeUndefined()
  })

  it('rejects a blank password with a 400', async () => {
    signInAs('bob@acme.com')
    await expect(verifyPassword('')).rejects.toMatchObject({
      status: 400,
      message: 'password must not be blank',
    })
  })

  it('rejects a wrong password with a 403', async () => {
    signInAs('bob@acme.com')
    await expect(verifyPassword('wrong')).rejects.toMatchObject({
      status: 403,
      message: 'Current password is incorrect',
    })
  })

  it('rejects with a 401 when nobody is signed in, or the account is gone', async () => {
    await expect(verifyPassword(DEMO_PASSWORD)).rejects.toMatchObject({
      status: 401,
      message: 'Sign in to continue',
    })

    signInAs('bob@acme.com')
    getDb().employees = getDb().employees.filter((e) => e.employeeId !== 'ENG-001')
    await expect(verifyPassword(DEMO_PASSWORD)).rejects.toMatchObject({ status: 401 })
  })
})

describe('changePassword', () => {
  it.each([
    ['', 'newpassword', 'currentPassword must not be blank'],
    [DEMO_PASSWORD, '', 'newPassword must not be blank'],
    [DEMO_PASSWORD, 'short', 'newPassword must be at least 8 characters'],
    ['samesame1', 'samesame1', 'newPassword must differ from the current password'],
  ])('rejects (%p, %p) with a 400: %s', async (current, next, message) => {
    signInAs('bob@acme.com')
    await expect(changePassword(current, next)).rejects.toMatchObject({ status: 400, message })
  })

  it('rejects with a 401 when nobody is signed in', async () => {
    await expect(changePassword(DEMO_PASSWORD, 'newpassword')).rejects.toMatchObject({ status: 401 })
  })

  it('rejects a wrong current password with a 403 and keeps the old one', async () => {
    signInAs('bob@acme.com')
    await expect(changePassword('wrong-one', 'newpassword')).rejects.toMatchObject({
      status: 403,
      message: 'Current password is incorrect',
    })
    await expect(verifyPassword(DEMO_PASSWORD)).resolves.toBeUndefined()
  })

  it('stores the new password, so sign-in and verify accept it and not the old one', async () => {
    const session = { token: 'mock-token-ENG-001', user: signInAs('bob@acme.com') }

    await expect(changePassword(DEMO_PASSWORD, 'brand-new-pass')).resolves.toEqual(session)
    expect(persistedEmployees().find((e) => e.employeeId === 'ENG-001').password).toBe('brand-new-pass')

    await expect(verifyPassword('brand-new-pass')).resolves.toBeUndefined()
    await expect(verifyPassword(DEMO_PASSWORD)).rejects.toMatchObject({ status: 403 })

    await logout()
    await expect(login('bob@acme.com', DEMO_PASSWORD)).rejects.toMatchObject({ status: 401 })
    await expect(login('bob@acme.com', 'brand-new-pass')).resolves.toMatchObject({
      user: { employeeId: 'ENG-001' },
    })
  })
})

describe('listDemoAccounts and renewToken', () => {
  it('lists the four demo accounts with the shared password', async () => {
    const { accounts, password } = await listDemoAccounts()
    expect(accounts.map((a) => a.email)).toEqual([
      'alice@acme.com', 'bob@acme.com', 'frank@acme.com', 'admin@acme.inc',
    ])
    expect(password).toBe(DEMO_PASSWORD)
  })

  it('renewToken hands back the current session, since mock tokens never expire', async () => {
    await expect(renewToken()).resolves.toBeNull()
    signInAs('frank@acme.com')
    await expect(renewToken()).resolves.toEqual(stored())
  })
})
