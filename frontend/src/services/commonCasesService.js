/**
 * Reference links for recurring problems. Served from content bundled with the app
 * (`src/content/commonCases.js`) in every mode; there is no backend for them yet.
 */
import { commonCases } from '../content/commonCases'

export async function listCommonCases() {
  // TODO(backend): GET /common-cases once a CMS or static-content endpoint exists
  return commonCases
}
