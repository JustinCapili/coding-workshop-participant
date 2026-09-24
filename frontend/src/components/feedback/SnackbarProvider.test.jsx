import { act, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SnackbarProvider from './SnackbarProvider'
import { useSnackbar } from './useSnackbar'

function renderProvider() {
  const { result } = renderHook(() => useSnackbar(), { wrapper: SnackbarProvider })
  return (...args) => act(() => result.current.notify(...args))
}

describe('SnackbarProvider', () => {
  it('shows nothing until notify is called', () => {
    renderProvider()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a message as a success by default', () => {
    const notify = renderProvider()

    notify('Report RPT-1 created')
    expect(screen.getByRole('alert')).toHaveTextContent('Report RPT-1 created')
    expect(screen.getByRole('alert')).toHaveClass('MuiAlert-filledSuccess')
  })

  it('shows a message with the given severity, replacing the previous one', async () => {
    const notify = renderProvider()

    notify('Report RPT-1 created')
    notify('Could not save', 'error')
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1))
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save')
    expect(screen.getByRole('alert')).toHaveClass('MuiAlert-filledError')
  })

  it('closes from the close button', async () => {
    const notify = renderProvider()

    notify('Password changed')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('closes when the user clicks elsewhere on the page', async () => {
    const notify = renderProvider()

    notify('Password changed')
    // MUI only listens for click-away once the snackbar has mounted.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    await userEvent.click(document.body)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('hides itself after four seconds', () => {
    jest.useFakeTimers()
    try {
      const notify = renderProvider()

      notify('Password changed')
      act(() => jest.advanceTimersByTime(3900))
      expect(screen.getByRole('alert')).toBeInTheDocument()
      act(() => jest.advanceTimersByTime(1000))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })
})
