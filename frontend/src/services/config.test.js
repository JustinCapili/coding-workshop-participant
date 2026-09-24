/** config.js reads VITE_USE_MOCKS once, at import, so each case loads a fresh copy. */
function loadWith(value) {
  const saved = process.env.VITE_USE_MOCKS
  if (value === undefined) delete process.env.VITE_USE_MOCKS
  else process.env.VITE_USE_MOCKS = value
  try {
    let config
    jest.isolateModules(() => {
      config = require('./config')
    })
    return config
  } finally {
    process.env.VITE_USE_MOCKS = saved
  }
}

describe('USE_MOCKS', () => {
  let info
  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    info.mockRestore()
  })

  it('is on only when VITE_USE_MOCKS is exactly "true", and says so once', () => {
    expect(loadWith('true').USE_MOCKS).toBe(true)
    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0][0]).toMatch(/^\[acme\] VITE_USE_MOCKS=true/)
  })

  it.each([undefined, 'false', 'TRUE', '1', ''])('is off for %p, silently', (value) => {
    expect(loadWith(value).USE_MOCKS).toBe(false)
    expect(info).not.toHaveBeenCalled()
  })
})
