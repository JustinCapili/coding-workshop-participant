/**
 * Reports against `ReportController` (/reports). The backend decides visibility and permissions
 * from the bearer token, so the viewer/author/admin arguments the pages pass are ignored here.
 */
import { http } from '../http'
import { assignmentRequest, closeRequest, comment, report } from './normalize'

const path = (reportId) => `/reports/${encodeURIComponent(reportId)}`

/** GET /reports?status=&location=&from=&to=&completedBy=&completedOnly=&openOnly= */
export async function listReports({
  status,
  location,
  from,
  to,
  completedBy,
  completedOnly = false,
  openOnly = false,
} = {}) {
  const list = await http.get('/reports', {
    status,
    location: location?.trim(),
    from,
    to,
    completedBy,
    completedOnly,
    openOnly,
  })
  return list.map(report)
}

/** GET /reports/{reportId}, with assignees, pending requests and the thread. */
export async function getReport(reportId) {
  return report(await http.get(path(reportId)))
}

/** GET /reports/requests?status=PENDING */
export async function listPendingRequests() {
  const res = await http.get('/reports/requests', { status: 'PENDING' })
  return {
    assignmentRequests: (res.assignmentRequests ?? []).map(assignmentRequest),
    closeRequests: (res.closeRequests ?? []).map(closeRequest),
  }
}

/** GET /reports/stats */
export async function getDashboardStats() {
  return http.get('/reports/stats')
}

/** POST /reports { title, body, location, incidentType?, priority? }. Empty type/priority are left out. */
export async function createReport({ title, body, location, incidentType, priority }) {
  return report(
    await http.post('/reports', {
      title,
      body,
      location,
      incidentType: incidentType || undefined,
      priority: priority || undefined,
    }),
  )
}

/** POST /reports/{reportId}/comments */
export async function addComment(reportId, body) {
  return comment(await http.post(`${path(reportId)}/comments`, { body }))
}

/** POST /reports/{reportId}/close-requests */
export async function requestClose(reportId) {
  return closeRequest(await http.post(`${path(reportId)}/close-requests`))
}

/** POST /reports/{reportId}/assignment-requests */
export async function requestAssignment(reportId) {
  return assignmentRequest(await http.post(`${path(reportId)}/assignment-requests`))
}

/** PATCH /reports/{reportId}/status */
export async function transitionReport(reportId, nextStatus) {
  return report(await http.patch(`${path(reportId)}/status`, { status: nextStatus }))
}

/** PUT /reports/{reportId}/assignees */
export async function assignEngineers(reportId, engineerIds) {
  return report(await http.put(`${path(reportId)}/assignees`, { engineerIds }))
}

const decide = (kind, requestId, verdict) =>
  http.post(`/reports/${kind}/${encodeURIComponent(requestId)}/${verdict}`)

export async function approveAssignmentRequest(requestId) {
  return report(await decide('assignment-requests', requestId, 'approve'))
}

export async function declineAssignmentRequest(requestId) {
  return assignmentRequest(await decide('assignment-requests', requestId, 'decline'))
}

export async function approveCloseRequest(requestId) {
  return report(await decide('close-requests', requestId, 'approve'))
}

export async function declineCloseRequest(requestId) {
  return closeRequest(await decide('close-requests', requestId, 'decline'))
}
