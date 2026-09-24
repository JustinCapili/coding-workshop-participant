import { screen } from '@testing-library/react'
import * as inventoryService from '../../services/inventoryService'
import { renderWithProviders, seededUser } from '../../test/renderApp'
import RequestInventoryPage from './RequestInventoryPage'

jest.mock('../../services/config', () => ({ USE_MOCKS: false }))

describe('RequestInventoryPage against the real backend', () => {
  it('says inventory requests are not available instead of showing the chat', () => {
    const list = jest.spyOn(inventoryService, 'listInventoryRequests')
    renderWithProviders(<RequestInventoryPage />, { auth: { user: seededUser('bob@acme.com') } })

    expect(screen.getByRole('heading', { level: 1, name: 'Request Inventory' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: "Inventory requests aren't available yet" })).toBeInTheDocument()
    expect(screen.getByText(/Ask your faculty admin for parts in the meantime/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
    list.mockRestore()
  })

  it('has a service that refuses with 501 rather than falling back to mock data', async () => {
    await expect(inventoryService.listInventoryRequests({ requesterId: 'ENG-001' })).rejects.toMatchObject({
      status: 501,
      message: 'Inventory requests are not connected to a backend yet',
    })
    await expect(inventoryService.submitInventoryRequest({ query: 'Lamp', requesterId: 'ENG-001' })).rejects.toMatchObject({
      status: 501,
    })
  })
})
