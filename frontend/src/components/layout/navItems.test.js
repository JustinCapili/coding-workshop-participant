import { Role, Scope } from '../../domain/roles'
import { sectionsFor } from './navItems'

const headings = (user) => sectionsFor(user).map((s) => s.heading)
const labels = (user) => sectionsFor(user).flatMap((s) => s.items.map((i) => i.label))

describe('sectionsFor', () => {
  it('shows an employee only the Dashboard and Common Cases', () => {
    const employee = { role: Role.EMPLOYEE }
    expect(headings(employee)).toEqual([null])
    expect(labels(employee)).toEqual(['Dashboard', 'Common Cases'])
  })

  it('adds the Engineer section for an engineer', () => {
    const engineer = { role: Role.ENGINEER }
    expect(headings(engineer)).toEqual([null, 'Engineer'])
    expect(labels(engineer)).toEqual([
      'Dashboard', 'Common Cases', 'Previous Reports', 'Request Inventory',
    ])
  })

  it('adds the Team section for a faculty admin, whatever their scope', () => {
    for (const scope of [Scope.TEAM, Scope.ALL]) {
      const admin = { role: Role.FACULTY_ADMIN, scope }
      expect(headings(admin)).toEqual([null, 'Engineer', 'Team'])
      expect(labels(admin)).toEqual([
        'Dashboard', 'Common Cases', 'Previous Reports', 'Request Inventory',
        'Create Engineer', 'Current Open Cases',
      ])
    }
  })

  it('adds Faculty Admins for admin@acme.inc alone, by address rather than scope', () => {
    const defaultAdmin = { role: Role.FACULTY_ADMIN, email: 'admin@acme.inc' }
    expect(labels(defaultAdmin)).toContain('Faculty Admins')
    expect(sectionsFor(defaultAdmin).at(-1).items.at(-1)).toMatchObject({ to: '/team/admins' })

    expect(labels({ role: Role.FACULTY_ADMIN, email: 'admin@acme.com', scope: Scope.ALL })).not.toContain('Faculty Admins')
    expect(labels({ role: Role.ENGINEER, email: 'admin@acme.inc' })).not.toContain('Faculty Admins')
  })

  it('links every item to a route and gives it an icon', () => {
    const items = sectionsFor({ role: Role.FACULTY_ADMIN }).flatMap((s) => s.items)
    expect(items.map((i) => i.to)).toEqual([
      '/dashboard', '/common-cases', '/reports/previous', '/inventory/request',
      '/team/engineers/new', '/team/open-cases',
    ])
    for (const item of items) expect(item.icon).toBeTruthy()
  })

  it('shows nothing with nobody signed in', () => {
    expect(sectionsFor(null)).toEqual([])
  })
})
