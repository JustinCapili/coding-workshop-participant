import { screen } from '@testing-library/react'
import { ReportStatus } from '../../domain/reportStatus'
import { renderWithProviders, seededUser } from '../../test/renderApp'
import ReportStatusActions from './ReportStatusActions'

const bob = seededUser('bob@acme.com') // engineer, the assignee below
const carol = seededUser('carol@acme.com') // engineer, not assigned
const frank = seededUser('frank@acme.com') // faculty admin

function reportIn(status, assigneeIds = ['ENG-001']) {
  return { reportId: 'RPT-1', status, assignees: assigneeIds.map((assigneeId) => ({ assigneeId })) }
}

function renderActions(report, user, props = {}) {
  const onTransition = jest.fn()
  const result = renderWithProviders(
    <ReportStatusActions report={report} user={user} onTransition={onTransition} {...props} />,
  )
  return { ...result, onTransition }
}

function buttonLabels() {
  return screen.queryAllByRole('button').map((b) => b.textContent)
}

describe('ReportStatusActions', () => {
  it.each([
    ['an assignee', 'ASSIGNED', bob, ['Start work']],
    ['an assignee', 'IN_PROGRESS', bob, ['Submit for review']],
    ['an assignee', 'SUBMITTED', bob, []],
    ['an assignee', 'APPROVED', bob, []],
    ['an engineer not on the case', 'ASSIGNED', carol, []],
    ['an engineer not on the case', 'IN_PROGRESS', carol, []],
    ['a faculty admin', 'UNASSIGNED', frank, []],
    ['a faculty admin', 'ASSIGNED', frank, ['Start work']],
    ['a faculty admin', 'IN_PROGRESS', frank, ['Submit for review']],
    ['a faculty admin', 'SUBMITTED', frank, ['Approve', 'Send back']],
    ['a faculty admin', 'APPROVED', frank, ['Archive']],
    ['a faculty admin', 'ARCHIVED', frank, []],
  ])('gives %s on a %s report: %p', (_, status, user, expected) => {
    renderActions(reportIn(status), user)

    expect(buttonLabels()).toEqual(expected)
  })

  it('renders nothing when no action applies', () => {
    const { container } = renderActions(reportIn(ReportStatus.UNASSIGNED, []), bob)

    expect(container).toBeEmptyDOMElement()
  })

  it('treats a report with no assignee list as having nobody on it', () => {
    renderActions({ reportId: 'RPT-1', status: ReportStatus.ASSIGNED }, bob)

    expect(buttonLabels()).toEqual([])
  })

  it.each([
    [ReportStatus.ASSIGNED, bob, 'Start work', ReportStatus.IN_PROGRESS],
    [ReportStatus.IN_PROGRESS, bob, 'Submit for review', ReportStatus.SUBMITTED],
    [ReportStatus.SUBMITTED, frank, 'Approve', ReportStatus.APPROVED],
    [ReportStatus.SUBMITTED, frank, 'Send back', ReportStatus.IN_PROGRESS],
    [ReportStatus.APPROVED, frank, 'Archive', ReportStatus.ARCHIVED],
  ])('from %s, pressing "%s" asks to move to %s', async (status, actor, label, next) => {
    const { user, onTransition } = renderActions(reportIn(status), actor)

    await user.click(screen.getByRole('button', { name: label }))

    expect(onTransition).toHaveBeenCalledWith(next)
  })

  it('disables every button while busy', () => {
    renderActions(reportIn(ReportStatus.SUBMITTED), frank, { busy: true })

    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send back' })).toBeDisabled()
  })
})
