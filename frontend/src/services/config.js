/**
 * Which implementation the service facades use.
 *
 * Real HTTP against `springboot-service` unless `VITE_USE_MOCKS=true` is set explicitly in
 * `.env.local`. Only then are the modules in `services/mock/` loaded at all: the facades import
 * them lazily, so in API mode no fixture is read and localStorage is never touched.
 */
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

if (USE_MOCKS) {
  console.info('[acme] VITE_USE_MOCKS=true: the UI is running on local mock data, not the backend.')
}
