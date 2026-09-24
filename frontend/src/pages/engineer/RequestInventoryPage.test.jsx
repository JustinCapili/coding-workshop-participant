import { screen, within } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import * as inventoryService from '../../services/inventoryService'
import { submitInventoryRequest } from '../../services/mock/inventoryMock'
import { renderApp } from '../../test/renderApp'

const queryField = () => screen.getByRole('textbox', { name: /what do you need/i })
const sendButton = () => screen.getByRole('button', { name: 'Send request' })
const chat = () => screen.getByText(/^Hi Bob, what do you need\?/).closest('[aria-live="polite"]')

async function renderInventory() {
  const result = renderApp({ route: '/inventory/request', as: 'bob@acme.com' })
  await screen.findByRole('heading', { level: 1, name: 'Request Inventory' })
  return result
}

afterEach(() => jest.restoreAllMocks())

describe('RequestInventoryPage (mock mode)', () => {
  it('greets the engineer by first name and says requests stay in this browser', async () => {
    await renderInventory()

    expect(screen.getByText('Hi Bob, what do you need? Include quantities and the room the part is for.')).toBeInTheDocument()
    expect(screen.getByText(/Mock mode — no inventory service exists/)).toBeInTheDocument()
    expect(queryField()).toHaveValue('')
    expect(sendButton()).toBeDisabled()
  })

  it('sends a request and shows it acknowledged in the chat', async () => {
    const { user } = await renderInventory()

    await user.type(queryField(), '2x lamp modules, Room 204')
    expect(sendButton()).toBeEnabled()
    await user.click(sendButton())

    expect(await within(chat()).findByText('2x lamp modules, Room 204')).toBeInTheDocument()
    expect(within(chat()).getByText(/^INV-\d+$/)).toBeInTheDocument()
    expect(within(chat()).getByText('RECEIVED')).toBeInTheDocument()
    expect(within(chat()).getByText('just now')).toBeInTheDocument()
    expect(queryField()).toHaveValue('')
  })

  it('sends on Enter, while Shift+Enter starts a new line', async () => {
    const submit = jest.spyOn(inventoryService, 'submitInventoryRequest')
    const { user } = await renderInventory()

    await user.type(queryField(), 'Toner cartridge{Shift>}{Enter}{/Shift}Room 110')
    expect(queryField()).toHaveValue('Toner cartridge\nRoom 110')
    expect(submit).not.toHaveBeenCalled()

    await user.keyboard('{Enter}')
    expect(await within(chat()).findByText(/Toner cartridge\s+Room 110/)).toBeInTheDocument()
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('sends nothing for a blank message', async () => {
    const submit = jest.spyOn(inventoryService, 'submitInventoryRequest')
    const { user } = await renderInventory()

    await user.type(queryField(), '   {Enter}')
    expect(sendButton()).toBeDisabled()
    // A submit that gets past the disabled button, such as an implicit form submit, is ignored too.
    queryField().closest('form').requestSubmit()
    expect(submit).not.toHaveBeenCalled()
  })

  it('links a request to one of the engineer’s open incidents', async () => {
    const { user } = await renderInventory()

    await user.click(screen.getByRole('combobox', { name: /related incident/i }))
    const options = within(await screen.findByRole('listbox')).getAllByRole('option')
    expect(options[0]).toHaveTextContent('None')
    expect(options.map((o) => o.textContent)).toContain('RPT-1001 — Projector in Room 204 not powering on')
    await user.click(screen.getByRole('option', { name: 'RPT-1001 — Projector in Room 204 not powering on' }))

    await user.type(queryField(), 'Replacement lamp module{Enter}')
    expect(await within(chat()).findByText('just now · RPT-1001')).toBeInTheDocument()
  })

  it('shows the engineer’s earlier requests, oldest first, and nobody else’s', async () => {
    await submitInventoryRequest({ query: 'First request', requesterId: 'ENG-001' })
    await submitInventoryRequest({ query: 'Carol’s request', requesterId: 'ENG-002' })
    await submitInventoryRequest({ query: 'Second request', requesterId: 'ENG-001', reportId: 'RPT-1005' })
    await renderInventory()

    const first = await within(chat()).findByText('First request')
    const second = within(chat()).getByText('Second request')
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(chat()).queryByText('Carol’s request')).not.toBeInTheDocument()
    expect(within(chat()).getByText('just now · RPT-1005')).toBeInTheDocument()
  })

  it('shows why a request was refused', async () => {
    const { user } = await renderInventory()

    await user.type(queryField(), 'Fuse{Enter}')
    expect(await screen.findByText('Describe the part or quantity you need (at least 5 characters)')).toBeInTheDocument()
    expect(queryField()).toHaveValue('Fuse')
  })

  it('shows a failure to load earlier requests with Retry', async () => {
    jest.spyOn(inventoryService, 'listInventoryRequests').mockRejectedValueOnce(new ApiError(500, 'Boom'))
    const { user } = await renderInventory()

    expect(await within(chat()).findByText('Boom')).toBeInTheDocument()
    await user.click(within(chat()).getByRole('button', { name: 'Retry' }))
    expect(within(chat()).queryByText('Boom')).not.toBeInTheDocument()
    expect(inventoryService.listInventoryRequests).toHaveBeenCalledTimes(2)
  })

  it('locks the form while a request is being sent', async () => {
    jest.spyOn(inventoryService, 'submitInventoryRequest').mockReturnValue(new Promise(() => {}))
    const { user } = await renderInventory()

    await user.type(queryField(), 'Spare HDMI cable{Enter}')
    expect(queryField()).toBeDisabled()
    expect(sendButton()).toBeDisabled()
    expect(screen.getByRole('combobox', { name: /related incident/i })).toHaveAttribute('aria-disabled', 'true')
  })
})
