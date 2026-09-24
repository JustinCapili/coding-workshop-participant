/**
 * Mock parts / inventory requests, used only when VITE_USE_MOCKS=true. Requests are recorded in
 * the mock store and acknowledged so the flow can be demoed.
 */
import { ApiError } from '../apiError'
import { commit, delay, getDb, nextId } from './mockStore'

function collection() {
  const db = getDb()
  if (!Array.isArray(db.inventoryRequests)) db.inventoryRequests = []
  return db.inventoryRequests
}

export async function submitInventoryRequest({ query, reportId, requesterId }) {
  await delay(350)
  const text = (query ?? '').trim()
  if (text.length < 5) {
    throw new ApiError(400, 'Describe the part or quantity you need (at least 5 characters)')
  }
  const request = {
    requestId: nextId('INV'),
    query: text,
    reportId: reportId || null,
    requesterId,
    status: 'RECEIVED',
    createdAt: new Date().toISOString(),
  }
  collection().unshift(request)
  commit()
  return request
}

export async function listInventoryRequests({ requesterId }) {
  await delay(100)
  return collection().filter((r) => r.requesterId === requesterId)
}
