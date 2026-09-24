/**
 * Creates the accounts the load scenarios sign in as, through the API, and writes them to
 * users.json: plain employees (self-registered), engineers on the admin's team, and the admin.
 * Each employee also files one report, so the read scenarios have something to read from the start.
 *
 * Safe to run again: an account that already exists is signed in to rather than created.
 */
import { writeFile } from 'node:fs/promises'
import { ADMIN, BASE_PATH, EMPLOYEES, ENGINEERS, PASSWORD, TARGET, USERS_FILE } from './config.js'

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${TARGET}${BASE_PATH}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  return { status: response.status, data: text ? JSON.parse(text) : null }
}

async function login(email, password) {
  const { status, data } = await call('POST', '/auth/login', { body: { email, password } })
  return status === 200 ? data : null
}

async function main() {
  const admin = await login(ADMIN.email, ADMIN.password)
  if (!admin) {
    throw new Error(`Cannot sign in as ${ADMIN.email} at ${TARGET}${BASE_PATH}. Is the backend up ` +
      '(./start-backend.sh), and are ADMIN_EMAIL / ADMIN_PASSWORD right?')
  }

  const engineers = []
  for (let i = 1; i <= ENGINEERS; i += 1) {
    const email = `load.engineer${i}@acme.inc`
    if (!(await login(email, PASSWORD))) {
      const { status, data } = await call('POST', '/engineers', {
        token: admin.token,
        body: { email, password: PASSWORD, employeeId: `LOAD-ENG-${i}`, facultyAdminId: admin.user.employeeId },
      })
      if (status !== 201) throw new Error(`Creating ${email}: ${status} ${data?.message ?? ''}`)
    }
    engineers.push({ email, password: PASSWORD })
  }

  const employees = []
  for (let i = 1; i <= EMPLOYEES; i += 1) {
    const email = `load.employee${i}@acme.inc`
    let session = await login(email, PASSWORD)
    if (!session) {
      const { status, data } = await call('POST', '/auth/register', { body: { email, password: PASSWORD } })
      if (status !== 201) throw new Error(`Registering ${email}: ${status} ${data?.message ?? ''}`)
      session = data
      await call('POST', '/reports', {
        token: session.token,
        body: { title: `Seed report ${i}`, location: `Room ${100 + i}`, incidentType: 'IT', priority: 'MEDIUM' },
      })
    }
    employees.push({ email, password: PASSWORD })
  }

  const users = { admins: [{ ...ADMIN }], engineers, employees }
  await writeFile(USERS_FILE, `${JSON.stringify(users, null, 2)}\n`)
  console.log(`Seeded ${employees.length} employees, ${engineers.length} engineers and 1 admin at ${TARGET}${BASE_PATH}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
