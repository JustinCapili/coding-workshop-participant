/**
 * The facade picks its implementation from USE_MOCKS at import time, so each mode loads a fresh
 * copy of it against auto-mocked implementations and checks which one each call reaches.
 */
jest.mock('./mock/reportsMock')
jest.mock('./api/reportsApi')

function load(useMocks) {
  jest.resetModules()
  jest.doMock('./config', () => ({ USE_MOCKS: useMocks }))
  return {
    service: require('./reportsService'),
    mock: require('./mock/reportsMock'),
    api: require('./api/reportsApi'),
  }
}

const viewer = { employeeId: 'FA-001' }

const DELEGATED = [
  ['listReports', [{ viewer, status: 'ASSIGNED' }]],
  ['getReport', ['RPT-1', { viewer }]],
  ['listPendingRequests', [{ viewer }]],
  ['getDashboardStats', [{ viewer }]],
  ['createReport', [{ title: 'T', location: 'L' }, viewer]],
  ['addComment', ['RPT-1', 'hello', viewer]],
  ['requestClose', ['RPT-1', viewer]],
  ['requestAssignment', ['RPT-1', viewer]],
  ['transitionReport', ['RPT-1', 'IN_PROGRESS', viewer]],
  ['assignEngineers', ['RPT-1', ['ENG-1'], viewer]],
  ['approveAssignmentRequest', ['AREQ-1', viewer]],
  ['declineAssignmentRequest', ['AREQ-1', viewer]],
  ['approveCloseRequest', ['CREQ-1', viewer]],
  ['declineCloseRequest', ['CREQ-1', viewer]],
]

it('exposes exactly the functions both implementations provide', () => {
  const { service } = load(true)
  expect(Object.keys(service).sort()).toEqual(DELEGATED.map(([name]) => name).sort())
})

describe('reportsService in mock mode', () => {
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
})

describe('reportsService in API mode', () => {
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
})
