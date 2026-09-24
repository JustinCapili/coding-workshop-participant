import { screen, within } from '@testing-library/react'
import { commonCases } from '../../content/commonCases'
import { ApiError } from '../../services/apiError'
import * as commonCasesService from '../../services/commonCasesService'
import { renderApp } from '../../test/renderApp'

async function renderCases() {
  const result = renderApp({ route: '/common-cases', as: 'alice@acme.com' })
  await screen.findByRole('heading', { level: 1, name: 'Common Cases' })
  return result
}

function caseLinks() {
  return within(screen.getByRole('main'))
    .queryAllByRole('link')
    .map((link) => link.textContent)
}

async function chooseCategory(user, name) {
  await user.click(screen.getByRole('combobox', { name: /category/i }))
  await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name }))
}

afterEach(() => jest.restoreAllMocks())

describe('CommonCasesPage', () => {
  it('says the links are bundled with the app', async () => {
    await renderCases()
    expect(screen.getByText('Links are bundled with the app; there is no backend for them yet.')).toBeInTheDocument()
  })

  it('lists every case as a link that opens in a new tab', async () => {
    await renderCases()

    expect(await screen.findByRole('link', { name: 'Projector will not power on' })).toHaveAttribute(
      'href',
      'https://support.acme.example/kb/projector-no-power',
    )
    expect(caseLinks()).toEqual(commonCases.map((c) => c.title))
    const link = screen.getByRole('link', { name: 'Resetting a badge reader' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('filters by category, with the categories sorted after "All categories"', async () => {
    const { user } = await renderCases()
    await screen.findByRole('link', { name: 'Projector will not power on' })

    await user.click(screen.getByRole('combobox', { name: /category/i }))
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All categories',
      'Facilities',
      'IT',
      'Safety',
    ])
    await user.click(screen.getByRole('option', { name: 'Safety' }))
    expect(caseLinks()).toEqual(['Resetting a badge reader'])

    await chooseCategory(user, 'Facilities')
    expect(caseLinks()).toEqual(['Reporting a water leak safely', 'HVAC thermostat recalibration'])

    await chooseCategory(user, 'All categories')
    expect(caseLinks()).toHaveLength(commonCases.length)
  })

  it('shows a loading state until the cases arrive', async () => {
    jest.spyOn(commonCasesService, 'listCommonCases').mockReturnValue(new Promise(() => {}))
    await renderCases()

    expect(within(screen.getByRole('main')).getByRole('status')).toHaveTextContent('Loading…')
    expect(screen.queryByRole('combobox', { name: /category/i })).not.toBeInTheDocument()
  })

  it('shows a failure with Retry, which loads the cases', async () => {
    jest.spyOn(commonCasesService, 'listCommonCases').mockRejectedValueOnce(new ApiError(500, 'Boom'))
    const { user } = await renderCases()

    expect(await screen.findByText('Boom')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('link', { name: 'Projector will not power on' })).toBeInTheDocument()
    expect(screen.queryByText('Boom')).not.toBeInTheDocument()
  })
})
