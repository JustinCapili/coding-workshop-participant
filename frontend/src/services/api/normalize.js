/**
 * Adapts backend responses to the shapes the pages were built against (the mock's shapes).
 *
 * The backend has no display name, no global-admin scope and upper-case activity kinds, so this
 * derives a name from the email, marks everybody TEAM scope, and lower-cases the kinds. Every API
 * result passes through here, which is what keeps `something.name` safe everywhere in the UI.
 */
import { Role, Scope } from '../../domain/roles'

/** `jane.doe@acme.com` → `Jane Doe`, the same rule the mock uses for new accounts. */
export function nameFromEmail(email) {
  if (!email) return 'Former employee'
  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** An EmployeeSummary (or any record with employeeId/email/role) as a UI person. */
export function person(summary) {
  if (!summary) return null
  return {
    ...summary,
    name: nameFromEmail(summary.email),
    email: summary.email ?? '',
    scope: Scope.TEAM,
  }
}

/** An EngineerResponse, which carries no role of its own. */
export function engineer(res) {
  return person({ ...res, role: Role.ENGINEER })
}

function activityEntry(entry) {
  return {
    ...entry,
    kind: entry.kind?.toLowerCase(),
    body: entry.body ?? '',
    author: person(entry.author) ?? person({ employeeId: entry.authorId }),
  }
}

/** A ReportResponse with every embedded person normalized. */
export function report(res) {
  if (!res) return null
  return {
    ...res,
    author: person(res.author) ?? person({ employeeId: res.authorId }),
    assignees: (res.assignees ?? []).map((a) => ({
      ...a,
      employee: person(a.employee) ?? person({ employeeId: a.assigneeId }),
    })),
    pendingAssignmentRequests: (res.pendingAssignmentRequests ?? []).map(assignmentRequest),
    pendingCloseRequest: res.pendingCloseRequest ? closeRequest(res.pendingCloseRequest) : null,
    activity: (res.activity ?? []).map(activityEntry),
  }
}

export function assignmentRequest(res) {
  return {
    ...res,
    engineer: person(res.engineer) ?? person({ employeeId: res.engineerId }),
    report: res.report ? report(res.report) : null,
  }
}

export function closeRequest(res) {
  return {
    ...res,
    requester: person(res.requester) ?? person({ employeeId: res.requestedBy }),
    report: res.report ? report(res.report) : null,
  }
}

export function comment(res) {
  return activityEntry(res)
}
