/**
 * Where the end-to-end suite finds the app and the API, and the account it starts from.
 *
 * E2E_BASE_URL  the running frontend (default: the dev server start-dev.sh serves)
 * E2E_API_URL   the backend as the frontend reaches it (default: the local proxy)
 * E2E_BROWSER   firefox (default) or chrome
 * E2E_HEADED    set to 1 to watch the browser instead of running headless
 * E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 *               a faculty admin to create the suite's accounts through (default: the seeded
 *               admin@acme.inc / password)
 */
export const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
export const API_URL = (
  process.env.E2E_API_URL ?? 'http://localhost:3001/api/springboot-service'
).replace(/\/$/, '')
export const BROWSER = process.env.E2E_BROWSER ?? 'firefox'
export const HEADED = process.env.E2E_HEADED === '1'

/**
 * The faculty admin the suite signs in as and creates engineers under; by default the one
 * DefaultAdminSeeder creates. The suite never changes its password.
 */
export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'admin@acme.inc',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'password',
}

/**
 * A suffix unique to this run, so every account and report a spec creates is its own and a spec
 * never depends on what earlier runs left in the database.
 */
export const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

/**
 * The domain of every account the suite creates. The company domain, so the accounts pass a
 * backend that only lets company addresses sign up; E2E_EMAIL_DOMAIN overrides it.
 */
export const EMAIL_DOMAIN = process.env.E2E_EMAIL_DOMAIN ?? 'acme.inc'

/** A fresh address for this run: `robin` → `robin.<run id>@acme.inc`, signing in as "Robin". */
export function emailFor(name) {
  return `${name}.${RUN_ID}@${EMAIL_DOMAIN}`
}
