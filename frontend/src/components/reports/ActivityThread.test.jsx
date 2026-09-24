import { fireEvent, screen, within } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import { renderWithProviders } from '../../test/renderApp'
import ActivityThread from './ActivityThread'

const HOUR = 60 * 60 * 1000
const ago = (ms) => new Date(Date.now() - ms).toISOString()

const alice = { employeeId: 'EMP-001', name: 'Alice Nguyen' }
const bob = { employeeId: 'ENG-001', name: 'Bob Martinez' }
const frank = { employeeId: 'FA-001', name: 'Frank Delgado' }

const activity = [
  { activityId: 'A1', kind: 'comment', authorId: alice.employeeId, author: alice, body: 'It was working yesterday.', createdAt: ago(5 * HOUR) },
  { activityId: 'A2', kind: 'assignment', authorId: frank.employeeId, author: frank, body: 'Assigned Bob Martinez', createdAt: ago(4 * HOUR) },
  { activityId: 'A3', kind: 'status', authorId: bob.employeeId, author: bob, body: 'ASSIGNED → IN_PROGRESS', createdAt: ago(3 * HOUR) },
  { activityId: 'A4', kind: 'comment', authorId: bob.employeeId, author: bob, body: 'Ordering a replacement lamp.', createdAt: ago(2 * HOUR) },
  { activityId: 'A5', kind: 'request', authorId: alice.employeeId, author: alice, body: 'Requested to close this report', createdAt: ago(HOUR) },
]

function renderThread(props = {}) {
  return renderWithProviders(
    <ActivityThread activity={activity} reportAuthorId={alice.employeeId} {...props} />,
  )
}

describe('ActivityThread', () => {
  it('says so when there is no activity yet', () => {
    renderWithProviders(<ActivityThread />)

    expect(screen.getByText('No activity yet.')).toBeInTheDocument()
  })

  it('shows comments with their author, marking the reporter', () => {
    renderThread()
    const thread = screen.getByRole('region', { name: 'Activity' })

    expect(within(thread).getByText('It was working yesterday.')).toBeInTheDocument()
    expect(within(thread).getByText('Ordering a replacement lamp.')).toBeInTheDocument()
    expect(within(thread).getAllByText('Reporter')).toHaveLength(1)
    expect(within(thread).getAllByText(/^commented /)).toHaveLength(2)
  })

  it('shows status changes as "changed status" with the move', () => {
    renderThread()

    expect(screen.getByText(/changed status/)).toBeInTheDocument()
    expect(screen.getByText('ASSIGNED → IN_PROGRESS')).toBeInTheDocument()
  })

  it('shows assignment and request events as a sentence after the actor', () => {
    renderThread()

    expect(screen.getByText(/assigned Bob Martinez/)).toBeInTheDocument()
    expect(screen.getByText(/requested to close this report/)).toBeInTheDocument()
  })

  it('falls back to "Unknown" and "System" when an entry has no author', () => {
    renderWithProviders(
      <ActivityThread
        activity={[
          { activityId: 'X1', kind: 'comment', body: 'Anonymous note', createdAt: ago(HOUR) },
          { activityId: 'X2', kind: 'escalation', createdAt: ago(HOUR) },
        ]}
      />,
    )

    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('has no comment box when the page gives no onComment', () => {
    renderThread()

    expect(screen.queryByRole('textbox', { name: 'Add a comment' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Comment' })).not.toBeInTheDocument()
  })

  it('posts the draft through onComment and clears the box once saved', async () => {
    const onComment = jest.fn().mockResolvedValue(undefined)
    const { user } = renderThread({ onComment })
    const box = screen.getByRole('textbox', { name: 'Add a comment' })

    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled()
    await user.type(box, 'Parts arrive Friday')
    await user.click(screen.getByRole('button', { name: 'Comment' }))

    expect(onComment).toHaveBeenCalledWith('Parts arrive Friday')
    expect(box).toHaveValue('')
  })

  it('keeps the Comment button disabled for a whitespace-only draft and ignores a submit', async () => {
    const onComment = jest.fn()
    const { user } = renderThread({ onComment })
    const box = screen.getByRole('textbox', { name: 'Add a comment' })

    await user.type(box, '   ')
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled()
    fireEvent.submit(box.closest('form'))

    expect(onComment).not.toHaveBeenCalled()
  })

  it('shows the error and keeps the draft when saving fails', async () => {
    const onComment = jest.fn().mockRejectedValue(new ApiError(400, 'Comment cannot be empty'))
    const { user } = renderThread({ onComment })
    const box = screen.getByRole('textbox', { name: 'Add a comment' })

    await user.type(box, 'Hello')
    await user.click(screen.getByRole('button', { name: 'Comment' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Comment cannot be empty')
    expect(box).toHaveValue('Hello')
  })

  it('disables the comment box and button when disabled', () => {
    renderThread({ onComment: jest.fn(), disabled: true })

    expect(screen.getByRole('textbox', { name: 'Add a comment' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled()
  })
})
