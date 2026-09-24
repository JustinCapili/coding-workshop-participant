import { screen } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import { renderWithProviders } from '../../test/renderApp'
import ConfirmDialog from './ConfirmDialog'

function renderDialog(props = {}) {
  const onConfirm = jest.fn()
  const onClose = jest.fn()
  const result = renderWithProviders(
    <ConfirmDialog open title="Archive report?" onConfirm={onConfirm} onClose={onClose} {...props} />,
  )
  return { ...result, onConfirm, onClose }
}

describe('ConfirmDialog', () => {
  it('shows the title and description with Cancel and a default Confirm button', () => {
    renderDialog({ description: 'It moves to Previous Reports.' })

    expect(screen.getByRole('dialog', { name: 'Archive report?' })).toBeInTheDocument()
    expect(screen.getByText('It moves to Previous Reports.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled()
  })

  it('leaves out the description when none is given and renders nothing when closed', () => {
    const { rerender, onConfirm, onClose } = renderDialog()
    expect(screen.getByRole('dialog').querySelector('.MuiDialogContentText-root')).toBeNull()

    rerender(<ConfirmDialog open={false} title="Archive report?" onConfirm={onConfirm} onClose={onClose} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onConfirm from the confirm button, using a custom label', async () => {
    const { user, onConfirm, onClose } = renderDialog({ confirmLabel: 'Archive' })

    await user.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose from Cancel and from Escape', async () => {
    const { user, onClose } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('disables both buttons and ignores Escape while busy', async () => {
    const { user, onClose } = renderDialog({ busy: true })

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows an error inside the dialog', () => {
    renderDialog({ error: new ApiError(409, 'Report is already archived') })

    expect(screen.getByRole('alert')).toHaveTextContent('Report is already archived')
  })
})
