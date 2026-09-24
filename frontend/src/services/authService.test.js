/**
 * The facade picks its implementation from USE_MOCKS at import time, so each mode loads a fresh
 * copy of it against auto-mocked implementations and checks which one each call reaches.
 */
jest.mock('./mock/authMock')
jest.mock('./api/authApi')

function load(useMocks) {
  jest.resetModules()
  jest.doMock('./config', () => ({ USE_MOCKS: useMocks }))
  return {
    service: require('./authService'),
    mock: require('./mock/authMock'),
    api: require('./api/authApi'),
  }
}

const DELEGATED = [
  ['login', ['a@acme.com', 'pw']],
  ['register', ['new@acme.com', 'password1']],
  ['logout', []],
  ['refreshSession', []],
  ['renewToken', []],
  ['verifyPassword', ['pw']],
  ['changePassword', ['old', 'newpassword']],
]

describe('authService in mock mode', () => {
  let service, mock, api
  beforeEach(() => {
    ({ service, mock, api } = load(true))
  })

  it.each(DELEGATED)('%s delegates to the mock with the same arguments', async (name, args) => {
    mock[name].mockResolvedValue(`mock ${name}`)
    await expect(service[name](...args)).resolves.toBe(`mock ${name}`)
    expect(mock[name]).toHaveBeenCalledWith(...args)
    expect(api[name]).not.toHaveBeenCalled()
  })

  it('lists the demo accounts from the mock', async () => {
    const demo = { accounts: [{ email: 'alice@acme.com' }], password: 'password' }
    mock.listDemoAccounts.mockResolvedValue(demo)
    await expect(service.listDemoAccounts()).resolves.toBe(demo)
  })

  it('passes a mock failure through', async () => {
    mock.login.mockRejectedValue(new Error('Invalid email or password'))
    await expect(service.login('a', 'b')).rejects.toThrow('Invalid email or password')
  })
})

describe('authService in API mode', () => {
  let service, mock, api
  beforeEach(() => {
    ({ service, mock, api } = load(false))
  })

  it.each(DELEGATED)('%s delegates to the API with the same arguments', async (name, args) => {
    api[name].mockResolvedValue(`api ${name}`)
    await expect(service[name](...args)).resolves.toBe(`api ${name}`)
    expect(api[name]).toHaveBeenCalledWith(...args)
    expect(mock[name]).not.toHaveBeenCalled()
  })

  it('lists no demo accounts, since real accounts are never listed', async () => {
    await expect(service.listDemoAccounts()).resolves.toBeNull()
    expect(mock.listDemoAccounts).not.toHaveBeenCalled()
  })
})
