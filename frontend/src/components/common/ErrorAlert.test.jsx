import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '../../services/apiError'
import ErrorAlert from './ErrorAlert'

describe('ErrorAlert', () => {
  it('renders nothing without an error', () => {
    const { container } = render(<ErrorAlert error={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the error's message", () => {
    render(<ErrorAlert error={new ApiError(404, 'Report RPT-9 not found')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Report RPT-9 not found')
  })

  it('shows a string error as is, and a generic message for an error without one', () => {
    const { rerender } = render(<ErrorAlert error="Could not save" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save')

    rerender(<ErrorAlert error={new Error('')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('offers Retry only when given onRetry, and calls it', async () => {
    const onRetry = jest.fn()
    const { rerender } = render(<ErrorAlert error="Boom" />)
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()

    rerender(<ErrorAlert error="Boom" onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
