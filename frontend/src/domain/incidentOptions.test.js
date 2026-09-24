import { INCIDENT_TYPES, PRIORITIES, labelFor } from './incidentOptions'

describe('incident options', () => {
  it('offers the backend IncidentType values in form order', () => {
    expect(INCIDENT_TYPES.map((o) => o.value)).toEqual(['FACILITIES', 'IT', 'SAFETY', 'OTHER'])
  })

  it('offers the backend Priority values from lowest to highest', () => {
    expect(PRIORITIES.map((o) => o.value)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  })

  it('freezes both lists', () => {
    expect(Object.isFrozen(INCIDENT_TYPES)).toBe(true)
    expect(Object.isFrozen(PRIORITIES)).toBe(true)
  })
})

describe('labelFor', () => {
  it('returns the label of a known value', () => {
    expect(labelFor(INCIDENT_TYPES, 'FACILITIES')).toBe('Facilities')
    expect(labelFor(PRIORITIES, 'CRITICAL')).toBe('Critical')
  })

  it('falls back to the raw value when it is not an option', () => {
    expect(labelFor(PRIORITIES, 'URGENT')).toBe('URGENT')
  })

  it('shows a dash when there is no value at all', () => {
    expect(labelFor(PRIORITIES, undefined)).toBe('—')
    expect(labelFor(PRIORITIES, null)).toBe('—')
  })
})
