/**
 * Runs once before any spec: fails fast, with the fix, when the stack the suite needs is not up.
 * Also wakes the Lambda, so the first spec does not spend its timeout on a cold start.
 */
import { health, login } from './api'
import { ADMIN, API_URL, BASE_URL } from './config'

const HINT = 'Start the local stack with ./bin/start-dev.sh (or set E2E_BASE_URL / E2E_API_URL).'

export default async function globalSetup() {
  // Selenium Manager downloads its own Firefox and geckodriver into ~/.cache/selenium (once) and
  // ignores the ones on PATH. On Ubuntu, Firefox is a snap: /usr/bin/firefox is a wrapper script
  // geckodriver refuses to start, and the snap's geckodriver cannot start any other Firefox.
  // Set here rather than in a spec: Selenium Manager is a child process that inherits the real
  // process.env, and a spec only sees Jest's per-file copy of it.
  process.env.SE_FORCE_BROWSER_DOWNLOAD ??= 'true'
  process.env.SE_SKIP_DRIVER_IN_PATH ??= 'true'

  try {
    const page = await fetch(`${BASE_URL}/login`, { signal: AbortSignal.timeout(15000) })
    if (!page.ok) throw new Error(`HTTP ${page.status}`)
  } catch (err) {
    throw new Error(`The frontend is not reachable at ${BASE_URL} (${err.message}). ${HINT}`, {
      cause: err,
    })
  }

  try {
    await health()
  } catch (err) {
    throw new Error(`The backend is not reachable at ${API_URL} (${err.message}). ${HINT}`, {
      cause: err,
    })
  }

  try {
    await login(ADMIN.email, ADMIN.password)
  } catch (err) {
    throw new Error(
      `Cannot sign in as the faculty admin ${ADMIN.email} (${err.message}). The suite creates its ` +
        'accounts through that admin. If its password was changed from the seeded "password", pass ' +
        'the current one: E2E_ADMIN_PASSWORD=... npm run test:e2e (DefaultAdminSeeder never resets ' +
        'an existing account).',
      { cause: err },
    )
  }
}
