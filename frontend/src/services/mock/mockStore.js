/**
 * In-memory store behind the mock service modules, used only when VITE_USE_MOCKS=true.
 *
 * Seeded from `fixtures.js` and persisted to localStorage so a page refresh keeps the demo
 * state. Every service function that mutates data calls `commit()` afterwards.
 */
import * as fixtures from './fixtures'

const STORAGE_KEY = 'acme-incident-mock-db-v1'

const COLLECTIONS = [
  'employees',
  'reports',
  'assignments',
  'activity',
  'assignmentRequests',
  'closeRequests',
]

function seed() {
  const db = {}
  for (const name of COLLECTIONS) {
    db[name] = fixtures[name].map((row) => ({ ...row }))
  }
  return db
}

function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (COLLECTIONS.every((c) => Array.isArray(parsed[c]))) return parsed
    }
  } catch {
    // Storage unavailable or corrupt — fall through to a fresh seed.
  }
  return seed()
}

// Built on first use rather than at import, so importing this module has no side effects: nothing
// reads localStorage or copies the fixtures until a mock service actually runs.
let db = null

export function getDb() {
  if (db === null) db = load()
  return db
}

export function commit() {
  if (db === null) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Best-effort persistence only.
  }
}

/** Throw away all demo changes and return to the fixtures. */
export function resetDb() {
  db = seed()
  commit()
}

let counter = Date.now() % 100000
export function nextId(prefix) {
  counter += 1
  return `${prefix}-${counter}`
}

/** Simulate network latency so loading states are exercised. */
export function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
