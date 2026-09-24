/**
 * Frontend view of the backend employee hierarchy: Employee -> Engineer -> FacultyAdmin.
 *
 * "Admin" (spec Open Question 1) has no backend counterpart. It is represented here as a
 * FacultyAdmin whose `scope` is ALL rather than TEAM, so it reuses every FacultyAdmin page
 * and differs only in which reports/engineers it can see.
 */
export const Role = Object.freeze({
  EMPLOYEE: 'EMPLOYEE',
  ENGINEER: 'ENGINEER',
  FACULTY_ADMIN: 'FACULTY_ADMIN',
})

export const Scope = Object.freeze({
  TEAM: 'TEAM',
  ALL: 'ALL',
})

const RANK = Object.freeze({
  [Role.EMPLOYEE]: 0,
  [Role.ENGINEER]: 1,
  [Role.FACULTY_ADMIN]: 2,
})

/** True when `user` holds `role` or a role that inherits from it. */
export function hasRole(user, role) {
  if (!user) return false
  return (RANK[user.role] ?? -1) >= (RANK[role] ?? Infinity)
}

export function isEngineer(user) {
  return hasRole(user, Role.ENGINEER)
}

export function isFacultyAdmin(user) {
  return hasRole(user, Role.FACULTY_ADMIN)
}

export function isGlobalAdmin(user) {
  return isFacultyAdmin(user) && user.scope === Scope.ALL
}

export function roleLabel(user) {
  if (!user) return ''
  if (isGlobalAdmin(user)) return 'Admin'
  switch (user.role) {
    case Role.FACULTY_ADMIN:
      return 'Faculty Admin'
    case Role.ENGINEER:
      return 'Engineer'
    default:
      return 'Employee'
  }
}
