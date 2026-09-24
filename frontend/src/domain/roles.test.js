import { Role, Scope, hasRole, isEngineer, isFacultyAdmin, isGlobalAdmin, roleLabel } from './roles'

const employee = { role: Role.EMPLOYEE }
const engineer = { role: Role.ENGINEER }
const facultyAdmin = { role: Role.FACULTY_ADMIN, scope: Scope.TEAM }
const globalAdmin = { role: Role.FACULTY_ADMIN, scope: Scope.ALL }

describe('hasRole', () => {
  it('ranks employee < engineer < faculty admin, each holding the roles below it', () => {
    expect(hasRole(employee, Role.EMPLOYEE)).toBe(true)
    expect(hasRole(employee, Role.ENGINEER)).toBe(false)
    expect(hasRole(engineer, Role.EMPLOYEE)).toBe(true)
    expect(hasRole(engineer, Role.ENGINEER)).toBe(true)
    expect(hasRole(engineer, Role.FACULTY_ADMIN)).toBe(false)
    expect(hasRole(facultyAdmin, Role.EMPLOYEE)).toBe(true)
    expect(hasRole(facultyAdmin, Role.FACULTY_ADMIN)).toBe(true)
  })

  it('is false with nobody signed in, an unknown user role, or an unknown required role', () => {
    expect(hasRole(null, Role.EMPLOYEE)).toBe(false)
    expect(hasRole({ role: 'JANITOR' }, Role.EMPLOYEE)).toBe(false)
    expect(hasRole(facultyAdmin, 'OWNER')).toBe(false)
  })
})

describe('role shortcuts', () => {
  it('isEngineer and isFacultyAdmin follow the ranking', () => {
    expect([employee, engineer, facultyAdmin].map(isEngineer)).toEqual([false, true, true])
    expect([employee, engineer, facultyAdmin].map(isFacultyAdmin)).toEqual([false, false, true])
  })

  it('isGlobalAdmin needs a faculty admin with ALL scope', () => {
    expect(isGlobalAdmin(globalAdmin)).toBe(true)
    expect(isGlobalAdmin(facultyAdmin)).toBe(false)
    expect(isGlobalAdmin({ role: Role.ENGINEER, scope: Scope.ALL })).toBe(false)
  })
})

describe('roleLabel', () => {
  it.each([
    [null, ''],
    [employee, 'Employee'],
    [engineer, 'Engineer'],
    [facultyAdmin, 'Faculty Admin'],
    [globalAdmin, 'Admin'],
  ])('labels %o as %p', (user, label) => {
    expect(roleLabel(user)).toBe(label)
  })
})
