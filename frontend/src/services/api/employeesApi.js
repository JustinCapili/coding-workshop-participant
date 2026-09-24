/**
 * Employee directory against `EngineerController` (/engineers), `EmployeeController` (/employees)
 * and `FacultyAdminController` (/faculty-admins). Every call needs a signed-in caller. Plain
 * employees are created by signing up (authApi.register), not here; an admin can promote one.
 */
import { Role } from '../../domain/roles'
import { http } from '../http'
import { engineer, person } from './normalize'

/** GET /engineers/{id}, falling back to /employees/{id} and then /faculty-admins/{id}. */
export async function getEmployee(employeeId) {
  const id = encodeURIComponent(employeeId)
  const lookups = [
    async () => engineer(await http.get(`/engineers/${id}`)),
    async () => person(await http.get(`/employees/${id}`)), // EmployeeSummary carries its role
    async () => person({ ...(await http.get(`/faculty-admins/${id}`)), role: Role.FACULTY_ADMIN }),
  ]
  for (const [i, lookup] of lookups.entries()) {
    try {
      return await lookup()
    } catch (err) {
      if (err.status !== 404 || i === lookups.length - 1) throw err
    }
  }
}

/** GET /engineers?facultyAdminId= */
export async function listEngineers({ facultyAdminId } = {}) {
  const list = await http.get('/engineers', { facultyAdminId })
  return list.map(engineer)
}

/** GET /faculty-admins */
export async function listFacultyAdmins() {
  const list = await http.get('/faculty-admins')
  return list.map((admin) => person({ ...admin, role: Role.FACULTY_ADMIN }))
}

/**
 * POST /engineers. The backend only lets an admin create engineers on their own team, and needs
 * an employee id and an initial password as well as the email.
 */
export async function createEngineer({ email, employeeId, password, facultyAdminId }) {
  const created = await http.post('/engineers', {
    email: email.trim(),
    employeeId: employeeId.trim(),
    password,
    facultyAdminId,
  })
  return { ...engineer(created), created: true }
}

/**
 * POST /employees/{id}/promote. Makes a plain employee an engineer on the signed-in admin's team;
 * the backend takes the team from the caller. The employee keeps their id, email and password.
 */
export async function promoteEmployee({ employeeId }) {
  const promoted = await http.post(`/employees/${encodeURIComponent(employeeId)}/promote`)
  return { ...engineer(promoted), promoted: true }
}

/** GET /employees: plain employees, neither engineers nor faculty admins. */
export async function listEmployees() {
  const list = await http.get('/employees')
  return list.map(person) // EmployeeSummary carries its role
}

/**
 * PUT /faculty-admins/{id}. Makes a plain employee or an engineer a faculty admin; only
 * admin@acme.inc may, and the backend takes the caller from the token, so the mock's `viewer` is not
 * sent. They keep their id, email and password.
 */
export async function promoteToFacultyAdmin({ employeeId }) {
  const promoted = await http.put(`/faculty-admins/${encodeURIComponent(employeeId)}`)
  return person({ ...promoted, role: Role.FACULTY_ADMIN })
}
