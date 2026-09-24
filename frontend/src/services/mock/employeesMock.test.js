import { Role, Scope } from '../../domain/roles'
import { ApiError } from '../apiError'
import {
  createEngineer,
  getEmployee,
  getEmployeeSync,
  listEmployees,
  listEngineers,
  listFacultyAdmins,
  promoteEmployee,
  promoteToFacultyAdmin,
  toPublic,
} from './employeesMock'
import { getDb } from './mockStore'

const ids = (list) => list.map((e) => e.employeeId)
const find = (employeeId) => getDb().employees.find((e) => e.employeeId === employeeId)
const persistedEmployees = () =>
  JSON.parse(window.localStorage.getItem('acme-incident-mock-db-v1')).employees

describe('toPublic', () => {
  it('keeps only the fields a client may see', () => {
    expect(toPublic({
      employeeId: 'E1', email: 'e@acme.com', name: 'E', role: Role.EMPLOYEE, scope: undefined,
      facultyAdminId: 'FA-001', password: 'secret', extra: 1,
    })).toEqual({
      employeeId: 'E1', email: 'e@acme.com', name: 'E', role: Role.EMPLOYEE, scope: undefined,
      facultyAdminId: 'FA-001',
    })
  })

  it('is null for no employee', () => {
    expect(toPublic(null)).toBeNull()
  })
})

describe('getEmployeeSync and getEmployee', () => {
  it('look up a seeded employee', async () => {
    const frank = {
      employeeId: 'FA-001', email: 'frank@acme.com', name: 'Frank Delgado',
      role: Role.FACULTY_ADMIN, scope: Scope.TEAM, facultyAdminId: 'FA-001',
    }
    expect(getEmployeeSync('FA-001')).toEqual(frank)
    await expect(getEmployee('FA-001')).resolves.toEqual(frank)
  })

  it('getEmployeeSync stands in a placeholder for someone who is gone', () => {
    expect(getEmployeeSync('GONE-1')).toEqual({ employeeId: 'GONE-1', name: 'Former employee', email: '' })
  })

  it('getEmployee answers 404 for someone who is gone', async () => {
    const err = await getEmployee('GONE-1').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 404, message: 'Employee GONE-1 not found' })
  })
})

describe('listEngineers and listFacultyAdmins', () => {
  it('lists every engineer, and not faculty admins', async () => {
    expect(ids(await listEngineers())).toEqual(['ENG-001', 'ENG-002', 'ENG-003'])
  })

  it("limits engineers to one faculty admin's team", async () => {
    expect(ids(await listEngineers({ facultyAdminId: 'FA-001' }))).toEqual(['ENG-001', 'ENG-002'])
    expect(ids(await listEngineers({ facultyAdminId: 'FA-002' }))).toEqual(['ENG-003'])
  })

  it('lists team faculty admins, leaving out the global admin', async () => {
    expect(ids(await listFacultyAdmins())).toEqual(['FA-001', 'FA-002'])
  })
})

describe('createEngineer', () => {
  it('creates a new engineer on the team from an unknown email', async () => {
    const created = await createEngineer({ email: '  Jane.Doe@ACME.inc ', facultyAdminId: 'FA-001' })

    expect(created).toEqual({
      employeeId: expect.stringMatching(/^ENG-\d+$/),
      email: 'jane.doe@acme.inc',
      name: 'Jane Doe',
      role: Role.ENGINEER,
      scope: undefined,
      facultyAdminId: 'FA-001',
      created: true,
    })
    expect(ids(await listEngineers({ facultyAdminId: 'FA-001' }))).toContain(created.employeeId)
    expect(persistedEmployees().map((e) => e.email)).toContain('jane.doe@acme.inc')
  })

  it('refuses to create an account outside @acme.inc, with a 400', async () => {
    const count = getDb().employees.length
    await expect(createEngineer({ email: 'jane.doe@acme.com', facultyAdminId: 'FA-001' })).rejects.toMatchObject({
      status: 400,
      message: 'email must be an @acme.inc address',
    })
    expect(getDb().employees).toHaveLength(count)
  })

  it('promotes an existing employee in place', async () => {
    const promoted = await createEngineer({ email: 'alice@acme.com', facultyAdminId: 'FA-002' })

    expect(promoted).toMatchObject({ employeeId: 'EMP-001', role: Role.ENGINEER, facultyAdminId: 'FA-002', moved: false })
    expect(find('EMP-001')).toMatchObject({ role: Role.ENGINEER, facultyAdminId: 'FA-002' })
  })

  it("moves an engineer from another admin's team rather than sharing them", async () => {
    const moved = await createEngineer({ email: 'dave@acme.com', facultyAdminId: 'FA-001' })

    expect(moved).toMatchObject({ employeeId: 'ENG-003', facultyAdminId: 'FA-001', moved: true })
    expect(ids(await listEngineers({ facultyAdminId: 'FA-002' }))).toEqual([])
  })

  it.each(['not-an-email', 'x@y', ''])('rejects the email %p with a 400', async (email) => {
    await expect(createEngineer({ email, facultyAdminId: 'FA-001' })).rejects.toMatchObject({
      status: 400,
      message: 'Enter a valid employee email address',
    })
  })

  it('refuses to demote a faculty admin, with a 409', async () => {
    await expect(createEngineer({ email: 'GRACE@acme.com', facultyAdminId: 'FA-001' })).rejects.toMatchObject({
      status: 409,
      message: 'grace@acme.com is a Faculty Admin and cannot be made an engineer',
    })
    expect(find('FA-002').role).toBe(Role.FACULTY_ADMIN)
  })

  it('refuses an engineer already on the same team, with a 409', async () => {
    await expect(createEngineer({ email: 'bob@acme.com', facultyAdminId: 'FA-001' })).rejects.toMatchObject({
      status: 409,
      message: 'bob@acme.com is already an engineer on your team',
    })
  })
})

describe('promoteEmployee', () => {
  it('makes a plain employee an engineer on the team, keeping their id, email and password', async () => {
    find('EMP-001').password = 'alices-own-password'

    const promoted = await promoteEmployee({ employeeId: 'EMP-001', facultyAdminId: 'FA-002' })

    expect(promoted).toEqual({ ...toPublic(find('EMP-001')), promoted: true })
    expect(find('EMP-001')).toMatchObject({
      role: Role.ENGINEER,
      facultyAdminId: 'FA-002',
      email: 'alice@acme.com',
      password: 'alices-own-password',
    })
    expect(persistedEmployees().find((e) => e.employeeId === 'EMP-001').role).toBe(Role.ENGINEER)
  })

  it.each([
    ['EMP-404', 404, 'No employee EMP-404'],
    ['ENG-001', 409, 'ENG-001 is already an engineer'],
    ['FA-001', 409, 'FA-001 is a faculty admin'],
  ])('refuses %s with %i "%s", changing nothing', async (employeeId, status, message) => {
    const before = JSON.stringify(getDb().employees)

    await expect(promoteEmployee({ employeeId, facultyAdminId: 'FA-002' })).rejects.toMatchObject({ status, message })
    expect(JSON.stringify(getDb().employees)).toBe(before)
  })
})

describe('listEmployees', () => {
  it('lists only plain employees', async () => {
    expect(ids(await listEmployees())).toEqual(['EMP-001', 'EMP-002'])
  })
})

describe('promoteToFacultyAdmin', () => {
  const admin = () => toPublic(find('ADM-001'))

  it('makes an engineer a faculty admin of their own team, keeping their id, email and password', async () => {
    find('ENG-001').password = 'bobs-own-password'

    const promoted = await promoteToFacultyAdmin({ employeeId: 'ENG-001', viewer: admin() })

    expect(promoted).toEqual(toPublic(find('ENG-001')))
    expect(find('ENG-001')).toMatchObject({
      role: Role.FACULTY_ADMIN,
      scope: Scope.TEAM,
      facultyAdminId: 'ENG-001',
      email: 'bob@acme.com',
      password: 'bobs-own-password',
    })
    expect(ids(await listEngineers({ facultyAdminId: 'FA-001' }))).toEqual(['ENG-002'])
    expect(ids(await listFacultyAdmins())).toContain('ENG-001')
    expect(persistedEmployees().find((e) => e.employeeId === 'ENG-001').role).toBe(Role.FACULTY_ADMIN)
  })

  it('makes a plain employee a faculty admin', async () => {
    await promoteToFacultyAdmin({ employeeId: 'EMP-001', viewer: admin() })
    expect(find('EMP-001').role).toBe(Role.FACULTY_ADMIN)
  })

  it.each([
    ['another faculty admin', 'FA-001'],
    ['an engineer', 'ENG-002'],
    ['nobody signed in', null],
  ])('refuses %s with a 403 before looking the id up', async (_, viewerId) => {
    const before = JSON.stringify(getDb().employees)
    const viewer = viewerId && toPublic(find(viewerId))

    for (const employeeId of ['ENG-001', 'NOPE']) {
      await expect(promoteToFacultyAdmin({ employeeId, viewer })).rejects.toMatchObject({
        status: 403,
        message: 'Only admin@acme.inc can promote to faculty admin',
      })
    }
    expect(JSON.stringify(getDb().employees)).toBe(before)
  })

  it.each([
    ['NOPE', 404, 'No employee NOPE'],
    ['FA-002', 409, 'FA-002 is already a faculty admin'],
  ])('refuses %s with %i "%s"', async (employeeId, status, message) => {
    await expect(promoteToFacultyAdmin({ employeeId, viewer: admin() })).rejects.toMatchObject({ status, message })
  })
})
