import { ApiError } from './apiError'
import { API_BASE_URL, SERVICE_PREFIX, http, setAuthToken, setUnauthorizedHandler } from './http'

const BASE = 'http://api.test/api/springboot-service'

function respond(status, body, statusText = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

const lastCall = () => global.fetch.mock.calls.at(-1)

const realFetch = global.fetch

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue(respond(200, { ok: true }))
})

afterEach(() => {
  global.fetch = realFetch
  setAuthToken(null)
  setUnauthorizedHandler(null)
})

describe('base URL', () => {
  it('comes from VITE_API_URL and always carries the service prefix', () => {
    expect(API_BASE_URL).toBe('http://api.test')
    expect(SERVICE_PREFIX).toBe('/api/springboot-service')
  })

  it('drops a trailing slash and defaults to the local proxy', () => {
    const saved = process.env.VITE_API_URL
    try {
      process.env.VITE_API_URL = 'http://example.test/'
      jest.isolateModules(() => {
        expect(require('./http').API_BASE_URL).toBe('http://example.test')
      })
      delete process.env.VITE_API_URL
      jest.isolateModules(() => {
        expect(require('./http').API_BASE_URL).toBe('http://localhost:3001')
      })
    } finally {
      process.env.VITE_API_URL = saved
    }
  })
})

describe('requests', () => {
  it('GETs the prefixed path with a JSON Accept header and no body', async () => {
    await expect(http.get('/reports')).resolves.toEqual({ ok: true })
    const [url, init] = lastCall()
    expect(url).toBe(`${BASE}/reports`)
    expect(init).toEqual({ method: 'GET', headers: { Accept: 'application/json' }, body: undefined })
  })

  it('builds a query string, dropping null, undefined, empty and false params', async () => {
    await http.get('/reports', {
      status: 'ASSIGNED',
      location: '',
      from: null,
      to: undefined,
      openOnly: false,
      completedOnly: true,
      page: 0,
      q: 'a b&c',
    })
    expect(lastCall()[0]).toBe(`${BASE}/reports?status=ASSIGNED&completedOnly=true&page=0&q=a+b%26c`)
  })

  it('adds no "?" when every param is dropped', async () => {
    await http.get('/reports', { status: undefined, openOnly: false })
    expect(lastCall()[0]).toBe(`${BASE}/reports`)
  })

  it.each(['post', 'put', 'patch'])('%s sends a JSON body with a Content-Type', async (method) => {
    await http[method]('/things/1', { name: 'x' })
    const [url, init] = lastCall()
    expect(url).toBe(`${BASE}/things/1`)
    expect(init.method).toBe(method.toUpperCase())
    expect(init.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' })
    expect(init.body).toBe('{"name":"x"}')
  })

  it('leaves out the body and Content-Type when a POST has no body', async () => {
    await http.post('/auth/refresh')
    const init = lastCall()[1]
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Accept: 'application/json' })
    expect(init.body).toBeUndefined()
  })

  it('DELETEs without a body', async () => {
    await http.delete('/things/1')
    const [url, init] = lastCall()
    expect(url).toBe(`${BASE}/things/1`)
    expect(init).toEqual({ method: 'DELETE', headers: { Accept: 'application/json' }, body: undefined })
  })

  it('sends the token set with setAuthToken as a Bearer header until it is cleared', async () => {
    setAuthToken('jwt-123')
    await http.get('/auth/me')
    expect(lastCall()[1].headers.Authorization).toBe('Bearer jwt-123')

    setAuthToken(null)
    await http.get('/auth/me')
    expect(lastCall()[1].headers).not.toHaveProperty('Authorization')
  })
})

describe('responses', () => {
  it('parses an empty body as null', async () => {
    global.fetch.mockResolvedValue(respond(204))
    await expect(http.post('/auth/verify-password', { password: 'x' })).resolves.toBeNull()
  })

  it('parses a body that is not JSON as null', async () => {
    global.fetch.mockResolvedValue(respond(200, '<html>oops</html>'))
    await expect(http.get('/reports')).resolves.toBeNull()
  })

  it('throws an ApiError with the backend message on a non-OK status', async () => {
    global.fetch.mockResolvedValue(respond(409, { message: 'Already archived' }, 'Conflict'))
    const err = await http.patch('/reports/1/status', { status: 'ARCHIVED' }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 409, message: 'Already archived', error: 'Conflict' })
  })

  it('falls back to the status text when the error body has no message', async () => {
    global.fetch.mockResolvedValue(respond(500, '', 'Internal Server Error'))
    await expect(http.get('/reports')).rejects.toMatchObject({
      status: 500,
      message: 'Internal Server Error',
    })

    global.fetch.mockResolvedValue(respond(404, { error: 'Not Found' }, 'Not Found'))
    await expect(http.get('/reports/x')).rejects.toMatchObject({ status: 404, message: 'Not Found' })
  })

  it('turns a fetch rejection into a status-0 network ApiError', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await http.get('/reports').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({
      status: 0,
      error: 'Network Error',
      message: 'Network error — could not reach the API',
    })
  })
})

describe('the unauthorized handler', () => {
  it('fires on a 401 from any path but sign-in', async () => {
    const handler = jest.fn()
    setUnauthorizedHandler(handler)
    global.fetch.mockResolvedValue(respond(401, { message: 'Token expired' }, 'Unauthorized'))

    await expect(http.get('/reports')).rejects.toMatchObject({ status: 401, message: 'Token expired' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not fire on a 401 from /auth/login, which just means a wrong password', async () => {
    const handler = jest.fn()
    setUnauthorizedHandler(handler)
    global.fetch.mockResolvedValue(respond(401, { message: 'Invalid email or password' }))

    await expect(http.post('/auth/login', { email: 'a', password: 'b' })).rejects.toMatchObject({
      status: 401,
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not fire on other error statuses', async () => {
    const handler = jest.fn()
    setUnauthorizedHandler(handler)
    global.fetch.mockResolvedValue(respond(403, { message: 'Forbidden' }))

    await expect(http.get('/reports')).rejects.toMatchObject({ status: 403 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('is optional: a 401 without a handler still throws', async () => {
    global.fetch.mockResolvedValue(respond(401, null, 'Unauthorized'))
    await expect(http.get('/auth/me')).rejects.toMatchObject({ status: 401, message: 'Unauthorized' })
  })
})
