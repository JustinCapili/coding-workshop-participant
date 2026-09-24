/**
 * Where the load tests point, and the accounts they use. Shared by seed.js and run.js.
 *
 * TARGET          the service's origin (default: the local server start-backend.sh runs)
 * BASE_PATH       prefix before every path: empty locally, /api/springboot-service through
 *                 CloudFront or the dev proxy
 * ADMIN_EMAIL, ADMIN_PASSWORD
 *                 the faculty admin the seed creates engineers under (default: the seeded
 *                 admin@acme.inc / password, which a fresh database from start-backend.sh has)
 */
export const TARGET = (process.env.TARGET ?? 'http://localhost:8081').replace(/\/$/, '')
export const BASE_PATH = (process.env.BASE_PATH ?? '').replace(/\/$/, '')
export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? 'admin@acme.inc',
  password: process.env.ADMIN_PASSWORD ?? 'password',
}

/** How many of each account the scenarios draw from, and their shared password. */
export const EMPLOYEES = 20
export const ENGINEERS = 5
export const PASSWORD = 'load-test-password'

/** Where seed.js writes the accounts and processor.cjs reads them. */
export const USERS_FILE = new URL('./users.json', import.meta.url)
