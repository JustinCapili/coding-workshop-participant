/**
 * Incident type and priority options for the Create Incident Report form.
 *
 * Mirrors the backend's com.example.classes.IncidentType and Priority enums and the CHECKs on
 * report.incident_type / report.priority; change all three together.
 */
export const INCIDENT_TYPES = Object.freeze([
  { value: 'FACILITIES', label: 'Facilities' },
  { value: 'IT', label: 'IT' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'OTHER', label: 'Other' },
])

export const PRIORITIES = Object.freeze([
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
])

export function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label ?? value ?? '—'
}
