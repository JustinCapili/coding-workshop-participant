import { Role, Scope } from '../../domain/roles'
import {
  createEngineer,
  getEmployee,
  listEmployees,
  listEngineers,
  listFacultyAdmins,
  promoteEmployee,
  promoteToFacultyAdmin,
} from './employeesApi'

const BASE = 'http://api.test/api/springboot-service'

const respond = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: '',
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
})

const paths = () => global.fetch.mock.calls.map(([url, init]) => `${init.method} ${url.replace(BASE, '')}`)

const realFetch = global.fetch

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  global.fetch = realFetch
})

describe('getEmployee', () => {
  it('returns an engineer from /engineers/{id}', async () => {
    global.fetch.mockResolvedValue(respond(200, { employeeId: 'ENG 1', email: 'bob@acme.com' }))

    await expect(getEmployee('ENG 1')).resolves.toEqual({
      employeeId: 'ENG 1',
      email: 'bob@acme.com',
      role: Role.ENGINEER,
      name: 'Bob',
      scope: Scope.TEAM,
    })
    expect(paths()).toEqual(['GET /engineers/ENG%201'])
  })

  it('falls back to /employees/{id} on a 404, keeping the role the summary carries', async () => {
    global.fetch
      .mockResolvedValueOnce(respond(404, { message: 'no engineer' }))
      .mockResolvedValueOnce(respond(200, { employeeId: 'EMP-1', email: 'alice@acme.com', role: 'EMPLOYEE' }))

    await expect(getEmployee('EMP-1')).resolves.toMatchObject({ role: Role.EMPLOYEE, name: 'Alice' })
    expect(paths()).toEqual(['GET /engineers/EMP-1', 'GET /employees/EMP-1'])
  })

  it('falls back to /faculty-admins/{id} last and marks the FACULTY_ADMIN role', async () => {
    global.fetch
      .mockResolvedValueOnce(respond(404))
      .mockResolvedValueOnce(respond(404))
      .mockResolvedValueOnce(respond(200, { employeeId: 'FA-1', email: 'frank@acme.com' }))

    await expect(getEmployee('FA-1')).resolves.toMatchObject({ role: Role.FACULTY_ADMIN, name: 'Frank' })
    expect(paths()).toEqual(['GET /engineers/FA-1', 'GET /employees/FA-1', 'GET /faculty-admins/FA-1'])
  })

  it('rethrows the last 404 when nobody has the id', async () => {
    global.fetch.mockResolvedValue(respond(404, { message: 'Faculty admin not found' }))
    await expect(getEmployee('X')).rejects.toMatchObject({ status: 404, message: 'Faculty admin not found' })
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('stops at the first error that is not a 404', async () => {
    global.fetch.mockResolvedValue(respond(403, { message: 'Forbidden' }))
    await expect(getEmployee('ENG-1')).rejects.toMatchObject({ status: 403 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('listEngineers and listFacultyAdmins', () => {
  it('lists engineers, filtered by team when asked', async () => {
    global.fetch.mockResolvedValue(respond(200, [{ employeeId: 'ENG-1', email: 'bob@acme.com' }]))

    await expect(listEngineers({ facultyAdminId: 'FA-1' })).resolves.toEqual([
      { employeeId: 'ENG-1', email: 'bob@acme.com', role: Role.ENGINEER, name: 'Bob', scope: Scope.TEAM },
    ])
    await listEngineers()
    expect(paths()).toEqual(['GET /engineers?facultyAdminId=FA-1', 'GET /engineers'])
  })

  it('lists faculty admins with the FACULTY_ADMIN role', async () => {
    global.fetch.mockResolvedValue(respond(200, [{ employeeId: 'FA-1', email: 'frank@acme.com' }]))

    await expect(listFacultyAdmins()).resolves.toEqual([
      { employeeId: 'FA-1', email: 'frank@acme.com', role: Role.FACULTY_ADMIN, name: 'Frank', scope: Scope.TEAM },
    ])
    expect(paths()).toEqual(['GET /faculty-admins'])
  })
})

describe('createEngineer', () => {
  it('posts the trimmed email and id with the password and team, and flags the result as created', async () => {
    global.fetch.mockResolvedValue(respond(201, { employeeId: 'ENG-9', email: 'new.eng@acme.com', facultyAdminId: 'FA-1' }))

    const created = await createEngineer({
      email: ' new.eng@acme.com ',
      employeeId: ' ENG-9 ',
      password: 'initial-pass',
      facultyAdminId: 'FA-1',
    })

    const [url, init] = global.fetch.mock.calls[0]
    expect(`${init.method} ${url.replace(BASE, '')}`).toBe('POST /engineers')
    expect(JSON.parse(init.body)).toEqual({
      email: 'new.eng@acme.com',
      employeeId: 'ENG-9',
      password: 'initial-pass',
      facultyAdminId: 'FA-1',
    })
    expect(created).toEqual({
      employeeId: 'ENG-9',
      email: 'new.eng@acme.com',
      facultyAdminId: 'FA-1',
      role: Role.ENGINEER,
      name: 'New Eng',
      scope: Scope.TEAM,
      created: true,
    })
  })
})

describe('promoteEmployee', () => {
  it('posts to the employee’s promote endpoint with no body, and flags the result as promoted', async () => {
    global.fetch.mockResolvedValue(respond(200, { employeeId: 'EMP-1A', email: 'sam.lee@acme.com', facultyAdminId: 'FA-1' }))

    const promoted = await promoteEmployee({ employeeId: 'EMP-1A', facultyAdminId: 'FA-1' })

    expect(paths()).toEqual(['POST /employees/EMP-1A/promote'])
    expect(global.fetch.mock.calls[0][1].body).toBeUndefined()
    expect(promoted).toEqual({
      employeeId: 'EMP-1A',
      email: 'sam.lee@acme.com',
      facultyAdminId: 'FA-1',
      role: Role.ENGINEER,
      name: 'Sam Lee',
      scope: Scope.TEAM,
      promoted: true,
    })
  })

  it('escapes the id in the path, and passes the backend’s refusal on', async () => {
    global.fetch.mockResolvedValue(respond(409, { message: 'a/b is already an engineer' }))

    await expect(promoteEmployee({ employeeId: 'a/b' })).rejects.toMatchObject({
      status: 409,
      message: 'a/b is already an engineer',
    })
    expect(paths()).toEqual(['POST /employees/a%2Fb/promote'])
  })
})

describe('listEmployees', () => {
  it('lists plain employees, keeping the role each summary carries', async () => {
    global.fetch.mockResolvedValue(respond(200, [{ employeeId: 'EMP-1A', email: 'sam.lee@acme.inc', role: 'EMPLOYEE' }]))

    await expect(listEmployees()).resolves.toEqual([
      { employeeId: 'EMP-1A', email: 'sam.lee@acme.inc', role: Role.EMPLOYEE, name: 'Sam Lee', scope: Scope.TEAM },
    ])
    expect(paths()).toEqual(['GET /employees'])
  })
})

describe('promoteToFacultyAdmin', () => {
  it('puts to /faculty-admins/{id} with no body, leaving the mock-only viewer out', async () => {
    global.fetch.mockResolvedValue(respond(200, { employeeId: 'ENG-1', email: 'bob@acme.com', managedEngineers: [] }))

    const promoted = await promoteToFacultyAdmin({ employeeId: 'ENG-1', viewer: { employeeId: 'ADM-001' } })

    expect(paths()).toEqual(['PUT /faculty-admins/ENG-1'])
    expect(global.fetch.mock.calls[0][1].body).toBeUndefined()
    expect(promoted).toEqual({
      employeeId: 'ENG-1',
      email: 'bob@acme.com',
      managedEngineers: [],
      role: Role.FACULTY_ADMIN,
      name: 'Bob',
      scope: Scope.TEAM,
    })
  })

  it('escapes the id in the path, and passes the backend’s refusal on', async () => {
    global.fetch.mockResolvedValue(respond(403, { message: 'Only admin@acme.inc can promote to faculty admin' }))

    await expect(promoteToFacultyAdmin({ employeeId: 'a/b' })).rejects.toMatchObject({
      status: 403,
      message: 'Only admin@acme.inc can promote to faculty admin',
    })
    expect(paths()).toEqual(['PUT /faculty-admins/a%2Fb'])
  })
})
