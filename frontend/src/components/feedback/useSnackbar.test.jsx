import { renderHook } from '@testing-library/react'
import SnackbarProvider from './SnackbarProvider'
import { useSnackbar } from './useSnackbar'

afterEach(() => jest.restoreAllMocks())

describe('useSnackbar', () => {
  it('throws when used outside <SnackbarProvider>', () => {
    // React reports the thrown render error to console.error as well.
    jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useSnackbar())).toThrow('useSnackbar must be used inside <SnackbarProvider>')
  })

  it('returns notify inside the provider', () => {
    const { result } = renderHook(() => useSnackbar(), { wrapper: SnackbarProvider })
    expect(result.current.notify).toEqual(expect.any(Function))
  })
})
