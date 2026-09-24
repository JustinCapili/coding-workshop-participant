/**
 * Parts / inventory requests raised by engineers. No inventory service exists yet (spec Open
 * Question 4), so this works only in mock mode (VITE_USE_MOCKS=true). Against the backend both
 * calls fail with 501 rather than falling back to mock data.
 */
import { ApiError } from './apiError'
import { USE_MOCKS } from './config'

/** Whether inventory requests can be made at all in the current mode. */
export const INVENTORY_AVAILABLE = USE_MOCKS

const notConnected = () =>
  new ApiError(501, 'Inventory requests are not connected to a backend yet')

async function impl() {
  if (!USE_MOCKS) throw notConnected()
  return import('./mock/inventoryMock')
}

// TODO(backend): POST /inventory/requests { query, reportId }
export const submitInventoryRequest = async (...args) =>
  (await impl()).submitInventoryRequest(...args)

// TODO(backend): GET /inventory/requests?requesterId=
export const listInventoryRequests = async (...args) =>
  (await impl()).listInventoryRequests(...args)
