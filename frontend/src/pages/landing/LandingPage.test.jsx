import { act, screen, within } from '@testing-library/react'
import { REPORT_STATUSES, STATUS_LABELS } from '../../domain/reportStatus'
import { renderApp } from '../../test/renderApp'

const HEADLINE = 'See something? Say something.'
const region = (name) => screen.getByRole('region', { name })

async function renderLanding() {
  const result = renderApp({ route: '/' })
  await screen.findByRole('heading', { level: 1, name: HEADLINE })
  return result
}

describe('LandingPage', () => {
  it('lays the page out in landmarks, with one h1 and a section per idea', async () => {
    await renderLanding()

    expect(screen.getByRole('banner')).toHaveTextContent('ACME Incident Reports')
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent(`© ${new Date().getFullYear()} ACME Inc. · For internal use`)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    for (const name of [HEADLINE, 'From pin to resolved', 'One tool, three roles', 'Ready when something breaks.']) {
      expect(region(name)).toBeInTheDocument()
    }
    expect(within(region(HEADLINE)).getByText('@acme.inc')).toBeInTheDocument()
  })

  it('walks through the six report stages in the order a report moves', async () => {
    await renderLanding()

    const stages = within(region('From pin to resolved')).getAllByRole('heading', { level: 3 })
    expect(stages.map((h) => h.textContent)).toEqual(REPORT_STATUSES.map((s) => STATUS_LABELS[s]))
    expect(within(region('From pin to resolved')).getByText('An assigned engineer starts the work.')).toBeInTheDocument()
  })

  it('says what each role does', async () => {
    await renderLanding()

    const roles = within(region('One tool, three roles'))
    expect(roles.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Employee',
      'Engineer',
      'Faculty Admin',
    ])
    expect(roles.getByText('Put engineers on reports and approve their requests')).toBeInTheDocument()
  })

  it.each([
    ['the top bar', () => screen.getByRole('banner'), 'Create account'],
    ['the hero', () => region(HEADLINE), 'Create your account'],
    ['the closing call', () => region('Ready when something breaks.'), 'Create an account'],
  ])('opens the sign-up form from %s', async (_, where, label) => {
    const { user } = await renderLanding()

    await user.click(within(where()).getByRole('link', { name: label }))

    expect(await screen.findByLabelText(/^confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  it('opens the sign-in form from the hero', async () => {
    const { user } = await renderLanding()

    await user.click(within(region(HEADLINE)).getByRole('link', { name: 'Sign in' }))

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^confirm password/i)).not.toBeInTheDocument()
  })

  it("shows a pin's report card, with its status and priority, when the pin gets focus", async () => {
    await renderLanding()
    const pin = screen.getByRole('button', { name: /^Safety incident in Hall B/ })

    act(() => pin.focus())

    expect(pin).toHaveAccessibleName(
      'Safety incident in Hall B: Wet floor by the east stairs, high priority, in progress',
    )
    expect(pin).toHaveAccessibleDescription(/Wet floor by the east stairs/)
    const card = document.getElementById(pin.getAttribute('aria-describedby'))
    expect(within(card).getByText('In progress')).toBeInTheDocument()
    expect(within(card).getByText('High priority')).toBeInTheDocument()
    expect(within(card).getByText('SAFETY · RPT-2043')).toBeInTheDocument()
  })
})
