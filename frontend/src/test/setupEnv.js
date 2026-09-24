/**
 * Runs before the test framework and before any module under test is imported.
 *
 * - react-router 7 builds a TextEncoder at import time, and jsdom does not provide one.
 * - Tests run on the mock backend (VITE_USE_MOCKS=true) unless a file says otherwise: its data is
 *   seeded and deterministic, so pages can be exercised end to end in jsdom. A file that needs API
 *   mode mocks services/config instead.
 */
import { TextDecoder, TextEncoder } from 'node:util'

globalThis.TextEncoder ??= TextEncoder
globalThis.TextDecoder ??= TextDecoder

process.env.VITE_USE_MOCKS ??= 'true'
process.env.VITE_API_URL ??= 'http://api.test'

// services/config.js announces mock mode on import; in tests that is one line of noise per file.
const info = console.info.bind(console)
console.info = (...args) => {
  if (typeof args[0] === 'string' && args[0].startsWith('[acme]')) return
  info(...args)
}
