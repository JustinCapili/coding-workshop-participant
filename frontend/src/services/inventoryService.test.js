jest.mock('./mock/inventoryMock')

/** A fresh copy of the service for one mode, with the ApiError class that copy throws. */
function load(useMocks) {
  jest.resetModules()
  jest.doMock('./config', () => ({ USE_MOCKS: useMocks }))
  return {
    service: require('./inventoryService'),
    mock: require('./mock/inventoryMock'),
    ApiError: require('./apiError').ApiError,
  }
}

describe('inventoryService in mock mode', () => {
  let service, mock
  beforeEach(() => {
    ({ service, mock } = load(true))
  })

  it('is available', () => {
    expect(service.INVENTORY_AVAILABLE).toBe(true)
  })

  it('submits and lists requests through the mock', async () => {
    const request = { query: '4x HDMI cables', reportId: 'RPT-1', requesterId: 'ENG-1' }
    mock.submitInventoryRequest.mockResolvedValue({ requestId: 'INV-1' })
    mock.listInventoryRequests.mockResolvedValue([{ requestId: 'INV-1' }])

    await expect(service.submitInventoryRequest(request)).resolves.toEqual({ requestId: 'INV-1' })
    await expect(service.listInventoryRequests({ requesterId: 'ENG-1' })).resolves.toEqual([
      { requestId: 'INV-1' },
    ])
    expect(mock.submitInventoryRequest).toHaveBeenCalledWith(request)
    expect(mock.listInventoryRequests).toHaveBeenCalledWith({ requesterId: 'ENG-1' })
  })
})

describe('inventoryService in API mode', () => {
  let service, mock, ApiError
  beforeEach(() => {
    ({ service, mock, ApiError } = load(false))
  })

  it('is not available', () => {
    expect(service.INVENTORY_AVAILABLE).toBe(false)
  })

  it.each(['submitInventoryRequest', 'listInventoryRequests'])(
    '%s fails with 501 instead of falling back to mock data',
    async (name) => {
      const err = await service[name]({ requesterId: 'ENG-1' }).catch((e) => e)
      expect(err).toBeInstanceOf(ApiError)
      expect(err).toMatchObject({
        status: 501,
        message: 'Inventory requests are not connected to a backend yet',
      })
      expect(mock[name]).not.toHaveBeenCalled()
    },
  )
})
