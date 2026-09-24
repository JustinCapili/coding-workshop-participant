/**
 * Direct API calls for arranging a spec's starting point: accounts a spec needs but is not about.
 *
 * What a spec tests always goes through the browser. Setting up, say, an engineer for the close
 * request flow through the Create Engineer page as well would only repeat report-lifecycle's
 * coverage of that page and make every spec slower.
 */
import { ADMIN, API_URL } from './config'

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status}: ${data?.message ?? text}`)
  }
  return data
}

/** Signs in and returns `{ token, user }`. */
export async function login(email, password) {
  return call('POST', '/auth/login', { body: { email, password } })
}

/** Creates a self-registered plain employee. */
export async function register(email, password) {
  return call('POST', '/auth/register', { body: { email, password } })
}

/** Creates an engineer on the suite's admin's team, as that admin. */
export async function createEngineer({ email, password, employeeId }) {
  const { token, user } = await login(ADMIN.email, ADMIN.password)
  return call('POST', '/engineers', {
    token,
    body: { email, password, employeeId, facultyAdminId: user.employeeId },
  })
}

/** GET on the service root, which answers without a token: wakes a cold Lambda. */
export async function health() {
  return call('GET', '/')
}
