/**
 * Sign-in and session. Real backend unless VITE_USE_MOCKS=true; see services/config.js.
 * The mock is imported lazily, so in API mode its code and data are never loaded.
 */
import * as api from './api/authApi'
import { USE_MOCKS } from './config'

const impl = () => (USE_MOCKS ? import('./mock/authMock') : Promise.resolve(api))

export const login = async (...args) => (await impl()).login(...args)
export const register = async (...args) => (await impl()).register(...args)
export const logout = async (...args) => (await impl()).logout(...args)
export const refreshSession = async (...args) => (await impl()).refreshSession(...args)
export const renewToken = async (...args) => (await impl()).renewToken(...args)
export const verifyPassword = async (...args) => (await impl()).verifyPassword(...args)
export const changePassword = async (...args) => (await impl()).changePassword(...args)

/**
 * The seeded demo accounts shown on the login card: `{ accounts, password }` in mock mode, and
 * null otherwise, since real accounts are never listed.
 */
export async function listDemoAccounts() {
  if (!USE_MOCKS) return null
  const mock = await import('./mock/authMock')
  return mock.listDemoAccounts()
}
