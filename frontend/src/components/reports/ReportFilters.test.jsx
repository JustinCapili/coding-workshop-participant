import { fireEvent, screen } from '@testing-library/react'
import { ReportStatus } from '../../domain/reportStatus'
import { renderWithProviders } from '../../test/renderApp'
import ReportFilters from './ReportFilters'

const engineers = [
  { employeeId: 'ENG-001', name: 'Bob Martinez' },
  { employeeId: 'ENG-002', name: 'Carol Singh' },
]

function renderFilters(props = {}) {
  const handlers = {
    onLocationChange: jest.fn(),
    onStatusChange: jest.fn(),
    onFromChange: jest.fn(),
    onToChange: jest.fn(),
    onEngineerChange: jest.fn(),
    onClear: jest.fn(),
  }
  const result = renderWithProviders(<ReportFilters engineers={engineers} {...handlers} {...props} />)
  return { ...result, ...handlers }
}

describe('ReportFilters', () => {
  it('reports each keystroke in the location box', async () => {
    const { user, onLocationChange } = renderFilters()

    await user.type(screen.getByRole('textbox', { name: 'Location' }), 'B')

    expect(onLocationChange).toHaveBeenCalledWith('B')
  })

  it('offers every status plus "All statuses" and reports the one picked', async () => {
    const { user, onStatusChange } = renderFilters()

    await user.click(screen.getByRole('combobox', { name: /status/i }))
    expect(screen.getByRole('option', { name: 'All statuses' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(7)
    await user.click(screen.getByRole('option', { name: 'Unassigned' }))

    expect(onStatusChange).toHaveBeenCalledWith(ReportStatus.UNASSIGNED)
  })

  it('limits the status list to the statuses it is given', async () => {
    const { user } = renderFilters({ statuses: [ReportStatus.ASSIGNED, ReportStatus.SUBMITTED] })

    await user.click(screen.getByRole('combobox', { name: /status/i }))

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All statuses',
      'Assigned',
      'Submitted',
    ])
  })

  it('reports the from and to dates', () => {
    const { onFromChange, onToChange } = renderFilters()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-02' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-02-03' } })

    expect(onFromChange).toHaveBeenCalledWith('2026-01-02')
    expect(onToChange).toHaveBeenCalledWith('2026-02-03')
  })

  it('lists the engineers under "Completed by" and reports the one picked', async () => {
    const { user, onEngineerChange } = renderFilters()

    await user.click(screen.getByRole('combobox', { name: /completed by/i }))
    expect(screen.getByRole('option', { name: 'Any engineer' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Carol Singh' }))

    expect(onEngineerChange).toHaveBeenCalledWith('ENG-002')
  })

  it('shows the current values of every control', () => {
    renderFilters({
      location: 'Room 204',
      status: ReportStatus.SUBMITTED,
      from: '2026-01-02',
      to: '2026-02-03',
      engineerId: 'ENG-001',
    })

    expect(screen.getByRole('textbox', { name: 'Location' })).toHaveValue('Room 204')
    expect(screen.getByRole('combobox', { name: /status/i })).toHaveTextContent('Submitted')
    expect(screen.getByLabelText('From')).toHaveValue('2026-01-02')
    expect(screen.getByLabelText('To')).toHaveValue('2026-02-03')
    expect(screen.getByRole('combobox', { name: /completed by/i })).toHaveTextContent('Bob Martinez')
  })

  it('keeps Clear disabled until a filter has a value', () => {
    renderFilters()

    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
  })

  it.each([
    ['location', { location: 'Room' }],
    ['status', { status: ReportStatus.ASSIGNED }],
    ['from date', { from: '2026-01-01' }],
    ['to date', { to: '2026-01-01' }],
    ['engineer', { engineerId: 'ENG-001' }],
  ])('enables Clear when the %s is set, and clicking it calls onClear', async (_, values) => {
    const { user, onClear } = renderFilters(values)

    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('renders only the controls whose handlers are provided', () => {
    renderWithProviders(<ReportFilters location="" onLocationChange={jest.fn()} />)

    expect(screen.getByRole('textbox', { name: 'Location' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
  })
})
