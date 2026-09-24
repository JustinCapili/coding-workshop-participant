/**
 * Thin fetch wrapper for the real backend.
 *
 * Base URL comes from the `.env.local` that `bin/generate-env.sh` writes (`VITE_API_URL`,
 * `http://localhost:3001` in local dev, where the CORS proxy strips `/api/springboot-service`
 * before forwarding). The service maps both path shapes, so the prefix is always sent.
 */
import { ApiError } from './apiError'

export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '')
export const SERVICE_PREFIX = '/api/springboot-service'

let authToken = null
let onUnauthorized = null

export function setAuthToken(token) {
  authToken = token
}

/**
 * Registers what to do when the backend rejects the token (401) on any call except sign-in,
 * whose 401 just means a wrong password. AuthProvider uses this to drop an expired session.
 */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

/** Builds `?a=1&b=2`, leaving out null, undefined, empty strings and `false`. */
function queryString(params) {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    search.append(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

function parse(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function request(method, path, { body, params } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}${SERVICE_PREFIX}${path}${queryString(params)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Network error — could not reach the API')
  }

  const data = parse(await response.text())
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && onUnauthorized) {
      onUnauthorized()
    }
    throw new ApiError(response.status, data?.message ?? response.statusText)
  }
  return data
}

export const http = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
}
