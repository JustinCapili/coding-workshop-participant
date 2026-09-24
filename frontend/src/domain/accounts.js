/**
 * The company's account rules, mirroring the backend's `CompanyAccounts`: every new account uses an
 * @acme.inc address, and the default admin, admin@acme.inc, is the only account that may make
 * faculty admins. The backend enforces both; the UI uses these to explain a refusal before it happens
 * and to show the promotion page only to the one account that can use it.
 */
import { isFacultyAdmin } from './roles'

export const COMPANY_DOMAIN = 'acme.inc'

export const DEFAULT_ADMIN_EMAIL = `admin@${COMPANY_DOMAIN}`

/** What a form says about any other address, before the backend is asked. */
export const COMPANY_EMAIL_MESSAGE = `Use your @${COMPANY_DOMAIN} email address`

/** What the backend (and so the mock) answers with a 400 for any other address. */
export const COMPANY_EMAIL_REFUSAL = `email must be an @${COMPANY_DOMAIN} address`

/** True for `someone@acme.inc`, ignoring case and surrounding spaces; subdomains do not count. */
export function isCompanyEmail(email) {
  const normalized = (email ?? '').trim().toLowerCase()
  const at = normalized.indexOf('@')
  return at > 0 && at === normalized.lastIndexOf('@') && normalized.slice(at + 1) === COMPANY_DOMAIN
}

/** True for the signed-in default admin: a faculty admin whose email is admin@acme.inc. */
export function isDefaultAdmin(user) {
  return isFacultyAdmin(user) && (user.email ?? '').trim().toLowerCase() === DEFAULT_ADMIN_EMAIL
}
