import { ApiError } from '../apiError'
import { listInventoryRequests, submitInventoryRequest } from './inventoryMock'
import { getDb } from './mockStore'

const persisted = () => JSON.parse(window.localStorage.getItem('acme-incident-mock-db-v1'))

describe('submitInventoryRequest', () => {
  it('records a trimmed request as RECEIVED and persists it', async () => {
    const request = await submitInventoryRequest({
      query: '  2x replacement lamp modules ',
      reportId: 'RPT-1001',
      requesterId: 'ENG-001',
    })

    expect(request).toEqual({
      requestId: expect.stringMatching(/^INV-\d+$/),
      query: '2x replacement lamp modules',
      reportId: 'RPT-1001',
      requesterId: 'ENG-001',
      status: 'RECEIVED',
      createdAt: expect.any(String),
    })
    expect(new Date(request.createdAt).toISOString()).toBe(request.createdAt)
    expect(persisted().inventoryRequests).toEqual([request])
  })

  it('stores no report link when none is given', async () => {
    const request = await submitInventoryRequest({ query: 'Spare HDMI cable', reportId: '', requesterId: 'ENG-001' })
    expect(request.reportId).toBeNull()
  })

  it.each([undefined, '', '   ', 'abcd', '  ab  '])(
    'rejects the query %p as too short with a 400',
    async (query) => {
      const err = await submitInventoryRequest({ query, requesterId: 'ENG-001' }).catch((e) => e)
      expect(err).toBeInstanceOf(ApiError)
      expect(err).toMatchObject({
        status: 400,
        message: 'Describe the part or quantity you need (at least 5 characters)',
      })
    },
  )
})

describe('listInventoryRequests', () => {
  it('is empty before anything is requested', async () => {
    expect(getDb().inventoryRequests).toBeUndefined()
    await expect(listInventoryRequests({ requesterId: 'ENG-001' })).resolves.toEqual([])
  })

  it("lists only the requester's own requests, newest first", async () => {
    const first = await submitInventoryRequest({ query: 'First request', requesterId: 'ENG-001' })
    await submitInventoryRequest({ query: 'Somebody else', requesterId: 'ENG-002' })
    const second = await submitInventoryRequest({ query: 'Second request', requesterId: 'ENG-001' })

    const mine = await listInventoryRequests({ requesterId: 'ENG-001' })
    expect(mine.map((r) => r.requestId)).toEqual([second.requestId, first.requestId])
  })
})
