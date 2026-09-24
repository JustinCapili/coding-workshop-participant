import { screen, within } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import * as reportsService from '../../services/reportsService'
import { renderApp, seededUser } from '../../test/renderApp'

const titleField = () => screen.getByLabelText(/^title/i)
const typeSelect = () => screen.getByRole('combobox', { name: /type of incident/i })
const prioritySelect = () => screen.getByRole('combobox', { name: /priority/i })
const locationField = () => screen.getByLabelText(/^location/i)
const descriptionField = () => screen.getByLabelText(/^description/i)
const submitButton = () => screen.getByRole('button', { name: 'Submit report' })

async function renderCreate() {
  const result = renderApp({ route: '/reports/new', as: 'alice@acme.com' })
  await screen.findByRole('heading', { level: 1, name: 'Create Incident Report' })
  return result
}

async function choose(user, select, option) {
  await user.click(select)
  await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name: option }))
}

async function fillValidReport(user) {
  await user.type(titleField(), 'Projector in Room 301 flickers')
  await choose(user, typeSelect(), 'IT')
  await choose(user, prioritySelect(), 'High')
  await user.type(locationField(), 'Building A, Room 301')
  await user.type(descriptionField(), 'Started this morning.')
}

afterEach(() => jest.restoreAllMocks())

describe('CreateReportPage', () => {
  it('starts empty at Medium priority, with hints instead of errors', async () => {
    await renderCreate()

    expect(titleField()).toHaveValue('')
    expect(prioritySelect()).toHaveTextContent('Medium')
    expect(screen.getByText('e.g. "Projector in Room 204 not powering on"')).toBeInTheDocument()
    expect(screen.getByText('Room number / floor')).toBeInTheDocument()
    expect(screen.queryByText('Give the report a short title')).not.toBeInTheDocument()
  })

  it('offers the incident types and priorities', async () => {
    const { user } = await renderCreate()

    await user.click(typeSelect())
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Facilities',
      'IT',
      'Safety',
      'Other',
    ])
    await user.keyboard('{Escape}')

    await user.click(prioritySelect())
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Low',
      'Medium',
      'High',
      'Critical',
    ])
  })

  it('checks a field once the user leaves it', async () => {
    const { user } = await renderCreate()

    await user.click(titleField())
    await user.tab()
    expect(screen.getByText('Give the report a short title')).toBeInTheDocument()
    expect(screen.queryByText('Where is the problem? Room number or floor')).not.toBeInTheDocument()

    await user.type(titleField(), 'Leak')
    expect(screen.getByText('Title should be at least 5 characters')).toBeInTheDocument()
    await user.type(titleField(), 's!')
    expect(screen.queryByText('Title should be at least 5 characters')).not.toBeInTheDocument()

    await user.click(locationField())
    await user.tab()
    expect(screen.getByText('Where is the problem? Room number or floor')).toBeInTheDocument()
  })

  it('lists every missing field on submit and files nothing', async () => {
    const createReport = jest.spyOn(reportsService, 'createReport')
    const { user } = await renderCreate()

    await user.click(submitButton())
    expect(screen.getByText('Give the report a short title')).toBeInTheDocument()
    expect(screen.getByText('Choose the type of incident')).toBeInTheDocument()
    expect(screen.getByText('Where is the problem? Room number or floor')).toBeInTheDocument()
    expect(createReport).not.toHaveBeenCalled()
  })

  it('files the report as the signed-in user and opens it, unassigned', async () => {
    const createReport = jest.spyOn(reportsService, 'createReport')
    const { user } = await renderCreate()

    await fillValidReport(user)
    await user.click(submitButton())

    expect(await screen.findByText(/^Report RPT-\d+ created$/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Projector in Room 301 flickers' })).toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.getByText('High priority')).toBeInTheDocument()
    expect(createReport).toHaveBeenCalledWith(
      {
        title: 'Projector in Room 301 flickers',
        incidentType: 'IT',
        priority: 'HIGH',
        location: 'Building A, Room 301',
        body: 'Started this morning.',
      },
      seededUser('alice@acme.com'),
    )
  })

  it('Cancel goes back to the dashboard without filing anything', async () => {
    const createReport = jest.spyOn(reportsService, 'createReport')
    const { user } = await renderCreate()
    await user.type(titleField(), 'Half-written report')

    await user.click(screen.getByRole('link', { name: 'Cancel' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, Alice' })).toBeInTheDocument()
    expect(createReport).not.toHaveBeenCalled()
  })

  it('shows a failure from the service and keeps what was typed', async () => {
    jest.spyOn(reportsService, 'createReport').mockRejectedValue(new ApiError(500, 'Boom'))
    const { user } = await renderCreate()

    await fillValidReport(user)
    await user.click(submitButton())

    expect(await screen.findByText('Boom')).toBeInTheDocument()
    expect(titleField()).toHaveValue('Projector in Room 301 flickers')
    expect(submitButton()).toBeEnabled()
    expect(screen.getByRole('heading', { level: 1, name: 'Create Incident Report' })).toBeInTheDocument()
  })

  it('locks the form while the report is being filed', async () => {
    jest.spyOn(reportsService, 'createReport').mockReturnValue(new Promise(() => {}))
    const { user } = await renderCreate()

    await fillValidReport(user)
    await user.click(submitButton())

    expect(titleField()).toBeDisabled()
    expect(locationField()).toBeDisabled()
    expect(screen.getByRole('button', { name: /submit report/i })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('aria-disabled', 'true')
  })
})
