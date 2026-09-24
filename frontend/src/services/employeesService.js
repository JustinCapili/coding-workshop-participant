/**
 * Employee directory: `/engineers` and `/faculty-admins`. Real backend unless
 * VITE_USE_MOCKS=true; see services/config.js. The mock is imported lazily, so in API mode its
 * code and data are never loaded.
 */
import * as api from './api/employeesApi'
import { USE_MOCKS } from './config'

const impl = () => (USE_MOCKS ? import('./mock/employeesMock') : Promise.resolve(api))

export const getEmployee = async (...args) => (await impl()).getEmployee(...args)
export const listEngineers = async (...args) => (await impl()).listEngineers(...args)
export const listFacultyAdmins = async (...args) => (await impl()).listFacultyAdmins(...args)
export const createEngineer = async (...args) => (await impl()).createEngineer(...args)
export const promoteEmployee = async (...args) => (await impl()).promoteEmployee(...args)
export const listEmployees = async (...args) => (await impl()).listEmployees(...args)
export const promoteToFacultyAdmin = async (...args) => (await impl()).promoteToFacultyAdmin(...args)
