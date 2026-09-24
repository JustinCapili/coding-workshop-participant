import { renderHook, waitFor } from '@testing-library/react'
import AuthProvider from './AuthProvider'
import { useAuth } from './useAuth'

afterEach(() => jest.restoreAllMocks())

describe('useAuth', () => {
  it('throws when used outside <AuthProvider>', () => {
    // React reports the thrown render error to console.error as well.
    jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used inside <AuthProvider>')
  })

  it('returns the auth context inside the provider', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.initializing).toBe(false))
    expect(result.current).toMatchObject({ user: null, token: null, login: expect.any(Function) })
  })
})
