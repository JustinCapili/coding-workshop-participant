import { render, screen } from '@testing-library/react'
import LoadingState from './LoadingState'

describe('LoadingState', () => {
  it('announces "Loading…" politely with a spinner', () => {
    render(<LoadingState />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Loading…')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('takes a custom label', () => {
    render(<LoadingState label="Restoring session…" minHeight="60vh" />)
    expect(screen.getByRole('status')).toHaveTextContent('Restoring session…')
  })
})
