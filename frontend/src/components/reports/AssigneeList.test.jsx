import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderApp'
import AssigneeList from './AssigneeList'

describe('AssigneeList', () => {
  it('says nobody is assigned when the list is empty', () => {
    renderWithProviders(<AssigneeList />)

    expect(screen.getByText('Nobody assigned yet')).toBeInTheDocument()
  })

  it('shows each assignee with initials, and the grant details on hover', () => {
    renderWithProviders(
      <AssigneeList
        assignees={[
          { assigneeId: 'ENG-001', employee: { name: 'Bob Martinez' }, accessLevel: 'CONTRIBUTOR', assignedBy: 'FA-001' },
          { assigneeId: 'ENG-002', employee: { name: 'Carol Singh' }, accessLevel: 'CONTRIBUTOR' },
        ]}
      />,
    )

    expect(screen.getByText('Bob Martinez')).toBeInTheDocument()
    expect(screen.getByText('BM')).toBeInTheDocument()
    expect(screen.getByTitle('CONTRIBUTOR · assigned by FA-001')).toBeInTheDocument()
    // No assigner recorded means the author's own grant.
    expect(screen.getByTitle('CONTRIBUTOR · assigned by author')).toHaveTextContent('Carol Singh')
  })

  it('falls back to the assignee id when the employee record is missing', () => {
    renderWithProviders(<AssigneeList assignees={[{ assigneeId: 'ENG-404', accessLevel: 'CONTRIBUTOR' }]} />)

    expect(screen.getByText('ENG-404')).toBeInTheDocument()
  })
})
