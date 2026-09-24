/**
 * The facade picks its implementation from USE_MOCKS at import time, so each mode loads a fresh
 * copy of it against auto-mocked implementations and checks which one each call reaches.
 */
jest.mock('./mock/employeesMock')
jest.mock('./api/employeesApi')

function load(useMocks) {
  jest.resetModules()
  jest.doMock('./config', () => ({ USE_MOCKS: useMocks }))
  return {
    service: require('./employeesService'),
    mock: require('./mock/employeesMock'),
    api: require('./api/employeesApi'),
  }
}

const DELEGATED = [
  ['getEmployee', ['ENG-001']],
  ['listEngineers', [{ facultyAdminId: 'FA-001' }]],
  ['listFacultyAdmins', []],
  ['createEngineer', [{ email: 'new@acme.com', facultyAdminId: 'FA-001' }]],
  ['promoteEmployee', [{ employeeId: 'EMP-001', facultyAdminId: 'FA-001' }]],
]

describe.each([
  ['mock mode', true, 'mock'],
  ['API mode', false, 'api'],
])('employeesService in %s', (_mode, useMocks, used) => {
  let impls, service
  beforeEach(() => {
    const loaded = load(useMocks)
    service = loaded.service
    impls = { mock: loaded.mock, api: loaded.api }
  })

  it.each(DELEGATED)(`%s delegates to the ${used} implementation`, async (name, args) => {
    const unused = used === 'mock' ? 'api' : 'mock'
    impls[used][name].mockResolvedValue(`${used} ${name}`)
    await expect(service[name](...args)).resolves.toBe(`${used} ${name}`)
    expect(impls[used][name]).toHaveBeenCalledWith(...args)
    expect(impls[unused][name]).not.toHaveBeenCalled()
  })
})
