import { DEFAULT_ADMIN_EMAIL, isCompanyEmail, isDefaultAdmin } from './accounts'
import { Role } from './roles'

describe('isCompanyEmail', () => {
  it.each(['pat@acme.inc', 'Pat.Lee@ACME.INC', '  pat@acme.inc  '])('accepts %j', (email) => {
    expect(isCompanyEmail(email)).toBe(true)
  })

  it.each([
    'pat@acme.com',
    'pat@sub.acme.inc',
    'pat@acme.inc.example.com',
    '@acme.inc',
    'pat@@acme.inc',
    'acme.inc',
    '',
    null,
    undefined,
  ])('refuses %j', (email) => {
    expect(isCompanyEmail(email)).toBe(false)
  })
})

describe('isDefaultAdmin', () => {
  it('is the faculty admin signed in as admin@acme.inc, in any case', () => {
    expect(isDefaultAdmin({ role: Role.FACULTY_ADMIN, email: DEFAULT_ADMIN_EMAIL })).toBe(true)
    expect(isDefaultAdmin({ role: Role.FACULTY_ADMIN, email: 'Admin@ACME.inc' })).toBe(true)
  })

  it('is nobody else', () => {
    expect(isDefaultAdmin({ role: Role.FACULTY_ADMIN, email: 'frank@acme.inc' })).toBe(false)
    expect(isDefaultAdmin({ role: Role.FACULTY_ADMIN, email: 'admin@acme.com' })).toBe(false)
    expect(isDefaultAdmin({ role: Role.ENGINEER, email: DEFAULT_ADMIN_EMAIL })).toBe(false)
    expect(isDefaultAdmin({ role: Role.EMPLOYEE, email: DEFAULT_ADMIN_EMAIL })).toBe(false)
    expect(isDefaultAdmin(null)).toBe(false)
  })
})
