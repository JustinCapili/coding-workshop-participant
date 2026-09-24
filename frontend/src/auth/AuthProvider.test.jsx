import { act, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { ApiError } from '../services/apiError'
import * as authService from '../services/authService'
import * as httpModule from '../services/http'
import { getDb } from '../services/mock/mockStore'
import { seededUser, signInAs } from '../test/renderApp'
import AuthProvider from './AuthProvider'
import { useAuth } from './useAuth'

const SESSION_KEY = 'acme-incident-session'
const MINUTE = 60 * 1000

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider })
}

async function renderRestored() {
  const rendered = renderAuth()
  await waitFor(() => expect(rendered.result.current.initializing).toBe(false))
  return rendered
}

afterEach(() => jest.restoreAllMocks())

describe('AuthProvider', () => {
  describe('on load', () => {
    it('is initializing until it has restored the saved session', async () => {
      const alice = signInAs('alice@acme.com')
      const { result } = renderAuth()

      expect(result.current).toMatchObject({ initializing: true, user: null, token: null })
      await waitFor(() => expect(result.current.initializing).toBe(false))
      expect(result.current.user).toEqual(alice)
      expect(result.current.token).toBe('mock-token-EMP-001')
      expect(result.current.sessionExpired).toBe(false)
    })

    it('finishes signed out when nothing was saved', async () => {
      const { result } = await renderRestored()
      expect(result.current).toMatchObject({ user: null, token: null })
    })

    it('ignores a restore that finishes after it has unmounted', async () => {
      let finishRestore
      jest.spyOn(authService, 'refreshSession').mockReturnValue(new Promise((resolve) => (finishRestore = resolve)))
      const setAuthToken = jest.spyOn(httpModule, 'setAuthToken')
      const { unmount } = renderAuth()

      unmount()
      await act(async () => finishRestore({ token: 'late', user: seededUser('bob@acme.com') }))
      expect(setAuthToken).not.toHaveBeenCalled()
    })
  })

  describe('actions', () => {
    it('login signs in, sends the token with API calls and returns the user', async () => {
      const setAuthToken = jest.spyOn(httpModule, 'setAuthToken')
      const { result } = await renderRestored()

      let returned
      await act(async () => {
        returned = await result.current.login('bob@acme.com', 'password')
      })
      expect(returned).toEqual(seededUser('bob@acme.com'))
      expect(result.current.user).toEqual(seededUser('bob@acme.com'))
      expect(result.current.token).toMatch(/^mock-token-ENG-001-/)
      expect(setAuthToken).toHaveBeenLastCalledWith(result.current.token)
    })

    it('login rejects wrong credentials and stays signed out', async () => {
      const { result } = await renderRestored()

      await act(() => expect(result.current.login('bob@acme.com', 'wrong')).rejects.toThrow('Invalid email or password'))
      expect(result.current.user).toBeNull()
    })

    it('register creates an employee account and signs it in', async () => {
      const { result } = await renderRestored()

      let returned
      await act(async () => {
        returned = await result.current.register('new.hire@acme.inc', 'longenough')
      })
      expect(returned).toMatchObject({ email: 'new.hire@acme.inc', name: 'New Hire', role: 'EMPLOYEE' })
      expect(result.current.user).toEqual(returned)
    })

    it('logout signs out and forgets the saved session', async () => {
      signInAs('alice@acme.com')
      const { result } = await renderRestored()

      await act(() => result.current.logout())
      expect(result.current).toMatchObject({ user: null, token: null, sessionExpired: false })
      expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
    })

    it('logout marks the sign-out as deliberate, until somebody signs in again', async () => {
      signInAs('alice@acme.com')
      const { result } = await renderRestored()
      expect(result.current.signedOut).toBe(false)

      await act(() => result.current.logout())
      expect(result.current.signedOut).toBe(true)

      await act(() => result.current.login('bob@acme.com', 'password'))
      expect(result.current.signedOut).toBe(false)

      await act(() => result.current.logout())
      await act(() => result.current.register('new.hire@acme.inc', 'longenough'))
      expect(result.current.signedOut).toBe(false)
    })

    it('refresh picks up a role change made elsewhere', async () => {
      signInAs('alice@acme.com')
      const { result } = await renderRestored()
      getDb().employees.find((e) => e.email === 'alice@acme.com').role = 'ENGINEER'

      let returned
      await act(async () => {
        returned = await result.current.refresh()
      })
      expect(returned.role).toBe('ENGINEER')
      expect(result.current.user.role).toBe('ENGINEER')
    })

    it('refresh signs out and returns null when the saved session is gone', async () => {
      signInAs('alice@acme.com')
      const { result } = await renderRestored()
      window.sessionStorage.clear()

      let returned
      await act(async () => {
        returned = await result.current.refresh()
      })
      expect(returned).toBeNull()
      expect(result.current.user).toBeNull()
    })

    it('changePassword switches to the session the backend returns', async () => {
      signInAs('alice@acme.com')
      jest.spyOn(authService, 'changePassword').mockResolvedValue({ token: 'fresh-token', user: seededUser('alice@acme.com') })
      const { result } = await renderRestored()

      let returned
      await act(async () => {
        returned = await result.current.changePassword('password', 'new-password')
      })
      expect(authService.changePassword).toHaveBeenCalledWith('password', 'new-password')
      expect(returned).toEqual(seededUser('alice@acme.com'))
      expect(result.current.token).toBe('fresh-token')
    })
  })

  describe('when the backend answers 401', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve(''),
      })
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('drops the session and marks it expired, until the next sign-in', async () => {
      signInAs('alice@acme.com')
      const { result } = await renderRestored()

      await act(() => expect(httpModule.http.get('/reports')).rejects.toMatchObject({ status: 401 }))
      // Not a deliberate sign-out: the page is remembered for signing straight back in.
      expect(result.current).toMatchObject({ user: null, token: null, sessionExpired: true, signedOut: false })
      await waitFor(() => expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull())

      await act(() => result.current.login('alice@acme.com', 'password'))
      expect(result.current.sessionExpired).toBe(false)
    })

    it('stops listening for 401s once unmounted', async () => {
      const setUnauthorizedHandler = jest.spyOn(httpModule, 'setUnauthorizedHandler')
      const { unmount } = await renderRestored()

      unmount()
      expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(null)
    })
  })

  describe('token renewal for sessions that expire (API mode)', () => {
    const NOW = new Date('2026-01-01T12:00:00Z').getTime()
    const alice = seededUser('alice@acme.com')
    const session = (token, minutesLeft) => ({
      token,
      expiresAt: new Date(Date.now() + minutesLeft * MINUTE).toISOString(),
      user: alice,
    })

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('renews the token 30 minutes before it expires, then again before the new one does', async () => {
      jest.spyOn(authService, 'refreshSession').mockResolvedValue(session('t1', 60))
      const renewToken = jest.spyOn(authService, 'renewToken').mockImplementation(async () => session('t2', 60))
      const { result } = renderAuth()
      await waitFor(() => expect(result.current.token).toBe('t1'))
      // waitFor advances the fake clock a little while polling, so measure from where it is now.
      const msUntil = (minutesAfterStart) => NOW + minutesAfterStart * MINUTE - Date.now()

      act(() => jest.advanceTimersByTime(msUntil(30) - 1))
      expect(renewToken).not.toHaveBeenCalled()
      act(() => jest.advanceTimersByTime(1))
      expect(renewToken).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(result.current.token).toBe('t2'))

      // t2 was issued at +30 min with an hour to live, so it is renewed at +60 min.
      act(() => jest.advanceTimersByTime(msUntil(60) - 1))
      expect(renewToken).toHaveBeenCalledTimes(1)
      act(() => jest.advanceTimersByTime(1))
      expect(renewToken).toHaveBeenCalledTimes(2)
    })

    it('renews at once when the restored token already has under 30 minutes left', async () => {
      jest.spyOn(authService, 'refreshSession').mockResolvedValue(session('t1', 10))
      jest.spyOn(authService, 'renewToken').mockResolvedValue(session('t2', 60))
      const { result } = renderAuth()

      await waitFor(() => expect(result.current.token).toBe('t2'))
      expect(authService.renewToken).toHaveBeenCalledTimes(1)
    })

    it('renews on window focus once the renewal time has passed, e.g. after the tab slept', async () => {
      jest.spyOn(authService, 'refreshSession').mockResolvedValue(session('t1', 60))
      const renewToken = jest.spyOn(authService, 'renewToken').mockResolvedValue(session('t2', 60))
      const { result } = renderAuth()
      await waitFor(() => expect(result.current.token).toBe('t1'))

      fireEvent.focus(window)
      expect(renewToken).not.toHaveBeenCalled()

      // The clock moves on without the timer firing, as it does while a laptop sleeps.
      jest.setSystemTime(NOW + 45 * MINUTE)
      fireEvent.focus(window)
      expect(renewToken).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(result.current.token).toBe('t2'))
    })

    it('keeps the current session when renewal fails or returns nothing', async () => {
      jest.spyOn(authService, 'refreshSession').mockResolvedValue(session('t1', 60))
      const renewToken = jest
        .spyOn(authService, 'renewToken')
        .mockRejectedValueOnce(new ApiError(503, 'Service unavailable'))
        .mockResolvedValueOnce(null)
      const { result } = renderAuth()
      await waitFor(() => expect(result.current.token).toBe('t1'))

      await act(async () => jest.advanceTimersByTime(30 * MINUTE))
      expect(renewToken).toHaveBeenCalledTimes(1)
      expect(result.current.token).toBe('t1')

      await act(async () => fireEvent.focus(window))
      expect(renewToken).toHaveBeenCalledTimes(2)
      expect(result.current.token).toBe('t1')
    })

    it('never renews a session without an expiry, as in mock mode', async () => {
      signInAs('alice@acme.com')
      const renewToken = jest.spyOn(authService, 'renewToken')
      const { result } = renderAuth()
      await waitFor(() => expect(result.current.user).toEqual(alice))

      act(() => jest.advanceTimersByTime(24 * 60 * MINUTE))
      fireEvent.focus(window)
      expect(renewToken).not.toHaveBeenCalled()
    })
  })
})
