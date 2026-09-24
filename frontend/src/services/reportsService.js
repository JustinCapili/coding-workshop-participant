/**
 * Reports, assignments, the activity thread and the two approval queues: `/reports`.
 * Real backend unless VITE_USE_MOCKS=true; see services/config.js.
 *
 * The mock is imported lazily, so in API mode its code and data are never loaded.
 *
 * Pages pass the current user as the last argument because the mock has no token to work out the
 * caller from. The API implementation ignores it; the backend uses the bearer token.
 */
import * as api from './api/reportsApi'
import { USE_MOCKS } from './config'

const impl = () => (USE_MOCKS ? import('./mock/reportsMock') : Promise.resolve(api))

export const listReports = async (...args) => (await impl()).listReports(...args)
export const getReport = async (...args) => (await impl()).getReport(...args)
export const listPendingRequests = async (...args) => (await impl()).listPendingRequests(...args)
export const getDashboardStats = async (...args) => (await impl()).getDashboardStats(...args)
export const createReport = async (...args) => (await impl()).createReport(...args)
export const addComment = async (...args) => (await impl()).addComment(...args)
export const requestClose = async (...args) => (await impl()).requestClose(...args)
export const requestAssignment = async (...args) => (await impl()).requestAssignment(...args)
export const transitionReport = async (...args) => (await impl()).transitionReport(...args)
export const assignEngineers = async (...args) => (await impl()).assignEngineers(...args)
export const approveAssignmentRequest = async (...args) =>
  (await impl()).approveAssignmentRequest(...args)
export const declineAssignmentRequest = async (...args) =>
  (await impl()).declineAssignmentRequest(...args)
export const approveCloseRequest = async (...args) => (await impl()).approveCloseRequest(...args)
export const declineCloseRequest = async (...args) => (await impl()).declineCloseRequest(...args)
