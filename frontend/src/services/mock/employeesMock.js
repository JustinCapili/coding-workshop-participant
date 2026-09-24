/**
 * Employee directory: mirrors `EngineerController` (`/engineers`) and `FacultyAdminController`
 * (`/faculty-admins`). Mock-backed today; each function notes the real call it maps to.
 */
import { COMPANY_EMAIL_REFUSAL, DEFAULT_ADMIN_EMAIL, isCompanyEmail, isDefaultAdmin } from '../../domain/accounts'
import { Role, Scope } from '../../domain/roles'
import { ApiError } from '../apiError'
import { commit, delay, getDb, nextId } from './mockStore'

/** Strip anything a client should never see (mirrors the backend's password-free responses). */
export function toPublic(employee) {
  if (!employee) return null
  const { employeeId, email, name, role, scope, facultyAdminId } = employee
  return { employeeId, email, name, role, scope, facultyAdminId }
}

/** Resolve an employee id to a public record, or a placeholder when the employee is gone. */
export function getEmployeeSync(employeeId) {
  const found = getDb().employees.find((e) => e.employeeId === employeeId)
  return found ? toPublic(found) : { employeeId, name: 'Former employee', email: '' }
}

export async function getEmployee(employeeId) {
  // TODO(backend): GET /engineers/{employeeId} or /faculty-admins/{employeeId}
  await delay(100)
  const found = getDb().employees.find((e) => e.employeeId === employeeId)
  if (!found) throw new ApiError(404, `Employee ${employeeId} not found`)
  return toPublic(found)
}

/**
 * Engineers, optionally limited to one faculty admin's team.
 * Mirrors GET /engineers?facultyAdminId=
 */
export async function listEngineers({ facultyAdminId } = {}) {
  await delay(150)
  return getDb()
    .employees.filter((e) => e.role === Role.ENGINEER) // faculty admins are not assignable engineers
    .filter((e) => !facultyAdminId || e.facultyAdminId === facultyAdminId)
    .map(toPublic)
}

/** Mirrors GET /faculty-admins */
export async function listFacultyAdmins() {
  await delay(100)
  return getDb()
    .employees.filter((e) => e.role === Role.FACULTY_ADMIN && e.scope !== Scope.ALL)
    .map(toPublic)
}

/**
 * Grant engineer permissions to an employee email under the given faculty admin.
 * Mirrors POST /faculty-admins/{employeeId}/engineers (or POST /engineers with facultyAdminId).
 *
 * Backend semantics preserved: an engineer already managed by another admin is moved, never held
 * by two admins. A faculty admin cannot be demoted to engineer (409).
 */
export async function createEngineer({ email, facultyAdminId }) {
  await delay(300)
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ApiError(400, 'Enter a valid employee email address')
  }
  const db = getDb()
  const existing = db.employees.find((e) => e.email.toLowerCase() === normalized)

  if (existing?.role === Role.FACULTY_ADMIN) {
    throw new ApiError(409, `${existing.email} is a Faculty Admin and cannot be made an engineer`)
  }
  if (existing?.role === Role.ENGINEER && existing.facultyAdminId === facultyAdminId) {
    throw new ApiError(409, `${existing.email} is already an engineer on your team`)
  }

  let engineer
  if (existing) {
    const moved = existing.role === Role.ENGINEER
    existing.role = Role.ENGINEER
    existing.facultyAdminId = facultyAdminId
    engineer = { ...toPublic(existing), moved }
  } else {
    // Only a new account has to be a company address; existing ones keep whatever they have.
    if (!isCompanyEmail(normalized)) throw new ApiError(400, COMPANY_EMAIL_REFUSAL)
    const record = {
      employeeId: nextId('ENG'),
      email: normalized,
      name: normalized.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      role: Role.ENGINEER,
      facultyAdminId,
    }
    db.employees.push(record)
    engineer = { ...toPublic(record), created: true }
  }
  commit()
  return engineer
}

/**
 * Make a plain employee an engineer on the given admin's team, by id. They keep their id, email
 * and password. Mirrors POST /employees/{employeeId}/promote, including its 404 and 409s.
 */
export async function promoteEmployee({ employeeId, facultyAdminId }) {
  await delay(300)
  const existing = getDb().employees.find((e) => e.employeeId === employeeId)
  if (!existing) throw new ApiError(404, `No employee ${employeeId}`)
  if (existing.role === Role.ENGINEER) throw new ApiError(409, `${employeeId} is already an engineer`)
  if (existing.role === Role.FACULTY_ADMIN) throw new ApiError(409, `${employeeId} is a faculty admin`)

  existing.role = Role.ENGINEER
  existing.facultyAdminId = facultyAdminId
  commit()
  return { ...toPublic(existing), promoted: true }
}

/** Plain employees: staff who are neither engineers nor faculty admins. Mirrors GET /employees */
export async function listEmployees() {
  await delay(150)
  return getDb()
    .employees.filter((e) => e.role === Role.EMPLOYEE)
    .map(toPublic)
}

/**
 * Make a plain employee or an engineer a faculty admin of their own team, by id. Only the default
 * admin may; `viewer` is the signed-in user, standing in for the backend's bearer token. Mirrors
 * PUT /faculty-admins/{employeeId}, including its 403 (checked first), 404 and 409.
 */
export async function promoteToFacultyAdmin({ employeeId, viewer }) {
  await delay(300)
  if (!isDefaultAdmin(viewer)) {
    throw new ApiError(403, `Only ${DEFAULT_ADMIN_EMAIL} can promote to faculty admin`)
  }
  const existing = getDb().employees.find((e) => e.employeeId === employeeId)
  if (!existing) throw new ApiError(404, `No employee ${employeeId}`)
  if (existing.role === Role.FACULTY_ADMIN) {
    throw new ApiError(409, `${employeeId} is already a faculty admin`)
  }

  // A faculty admin is managed by nobody; the fixtures record an admin's team as their own id.
  existing.role = Role.FACULTY_ADMIN
  existing.scope = Scope.TEAM
  existing.facultyAdminId = existing.employeeId
  commit()
  return toPublic(existing)
}
