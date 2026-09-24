/**
 * Runs in every test file, after Jest is installed and before the tests.
 *
 * - jest-dom matchers (toBeInTheDocument, toBeDisabled, …).
 * - The mock backend answers at once instead of after its simulated latency, so tests are quick
 *   and never race a timer. mockStore's own test asks for the real delay with jest.requireActual.
 * - Every test starts from the seeded mock data with nobody signed in.
 * - Stubs for the few browser APIs jsdom does not implement that the app calls.
 */
import '@testing-library/jest-dom'
import { resetDb } from '../services/mock/mockStore'

jest.mock('../services/mock/mockStore', () => ({
  ...jest.requireActual('../services/mock/mockStore'),
  delay: () => Promise.resolve(),
}))

// EmployeeDashboard scrolls to the status card; jsdom has no layout, so there is nothing to do.
Element.prototype.scrollIntoView = function scrollIntoView() {}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetDb()
})
