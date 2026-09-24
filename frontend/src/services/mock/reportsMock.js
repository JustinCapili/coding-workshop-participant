/**
 * Reports, assignments, activity thread and the two approval queues.
 *
 * Mirrors the future `ReportController` (`/reports`). Mock-backed today: every function notes
 * the endpoint it maps to. The `viewer` argument exists only because the mock has no auth
 * token to derive the caller from — the real implementation will ignore it and let the backend
 * scope results from the bearer token.
 */
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  ALLOWED_NEXT,
  COMPLETED_STATUSES,
  ReportStatus,
  canMoveTo,
  isOpen,
} from '../../domain/reportStatus'
import { Role, Scope, isFacultyAdmin } from '../../domain/roles'
import { ApiError } from '../apiError'
import { getEmployeeSync } from './employeesMock'
import { commit, delay, getDb, nextId } from './mockStore'

// ---------------------------------------------------------------------------------------------
// Scoping helpers (backend-side once auth exists)
// ---------------------------------------------------------------------------------------------

function teamOf(employeeId) {
  const employee = getDb().employees.find((e) => e.employeeId === employeeId)
  if (!employee) return null
  return employee.role === Role.FACULTY_ADMIN ? employee.employeeId : employee.facultyAdminId
}

function assigneeIdsOf(reportId) {
  return getDb()
    .assignments.filter((a) => a.reportId === reportId)
    .map((a) => a.assigneeId)
}

/** A report belongs to a team when its author or any assignee is on that team. */
function reportInTeam(report, teamId) {
  if (!teamId) return false
  if (teamOf(report.authorId) === teamId) return true
  return assigneeIdsOf(report.reportId).some((id) => teamOf(id) === teamId)
}

/**
 * A report whose author exists but is on no team (a self-registered employee) is shared: every
 * faculty admin and engineer sees it, as ReportService.visible does, or nobody could pick it up.
 */
function authorOnNoTeam(report) {
  return getDb().employees.some((e) => e.employeeId === report.authorId) && !teamOf(report.authorId)
}

function visibleTo(report, viewer) {
  if (!viewer) return false
  if (report.authorId === viewer.employeeId) return true
  if ((viewer.role === Role.FACULTY_ADMIN || viewer.role === Role.ENGINEER) && authorOnNoTeam(report)) {
    return true
  }
  switch (viewer.role) {
    case Role.FACULTY_ADMIN:
      return viewer.scope === Scope.ALL || reportInTeam(report, viewer.employeeId)
    case Role.ENGINEER:
      return (
        assigneeIdsOf(report.reportId).includes(viewer.employeeId) ||
        reportInTeam(report, viewer.facultyAdminId)
      )
    default:
      return false
  }
}

function requireReport(reportId) {
  const report = getDb().reports.find((r) => r.reportId === reportId)
  if (!report) throw new ApiError(404, `Report ${reportId} not found`)
  return report
}

function touch(report) {
  report.updatedAt = new Date().toISOString()
}

function addActivity(reportId, kind, authorId, body) {
  const entry = {
    activityId: nextId('ACT'),
    reportId,
    kind,
    authorId,
    body,
    createdAt: new Date().toISOString(),
  }
  getDb().activity.push(entry)
  return entry
}

/** Apply one legal ReportStatus move, recording it in the thread. */
function moveTo(report, next, actorId) {
  if (!canMoveTo(report.status, next)) {
    const allowed = ALLOWED_NEXT[report.status] ?? []
    throw new ApiError(
      409,
      `Cannot move report from ${report.status} to ${next}; allowed: ${allowed.join(', ') || 'none'}`,
    )
  }
  addActivity(report.reportId, 'status', actorId, `${report.status} → ${next}`)
  report.status = next
  touch(report)
}

function withPeople(report) {
  const assignments = getDb().assignments.filter((a) => a.reportId === report.reportId)
  return {
    ...report,
    author: getEmployeeSync(report.authorId),
    assignees: assignments.map((a) => ({ ...a, employee: getEmployeeSync(a.assigneeId) })),
    pendingAssignmentRequests: getDb()
      .assignmentRequests.filter((r) => r.reportId === report.reportId && r.status === 'PENDING')
      .map((r) => ({ ...r, engineer: getEmployeeSync(r.engineerId) })),
    pendingCloseRequest:
      getDb().closeRequests.find((r) => r.reportId === report.reportId && r.status === 'PENDING') ??
      null,
  }
}

function sameDay(iso, ref = new Date()) {
  const d = new Date(iso)
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  )
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

/**
 * List reports the viewer may see, newest first.
 * Mirrors GET /reports?status=&location=&from=&to=&completedBy=
 *
 * @param {object} opts
 * @param {object} opts.viewer          current user (dropped once the backend scopes by token)
 * @param {string} [opts.status]        exact ReportStatus
 * @param {string} [opts.location]      case-insensitive substring match
 * @param {string} [opts.from]          ISO date lower bound on updatedAt
 * @param {string} [opts.to]            ISO date upper bound on updatedAt (inclusive of that day)
 * @param {string} [opts.completedBy]   engineer employeeId who holds a grant on the report
 * @param {boolean} [opts.completedOnly] restrict to APPROVED/ARCHIVED
 * @param {boolean} [opts.openOnly]      restrict to non-ARCHIVED
 */
export async function listReports({
  viewer,
  status,
  location,
  from,
  to,
  completedBy,
  completedOnly = false,
  openOnly = false,
} = {}) {
  await delay(250)
  const needle = location?.trim().toLowerCase()
  const fromMs = from ? new Date(from).getTime() : null
  const toMs = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : null

  return getDb()
    .reports.filter((r) => visibleTo(r, viewer))
    .filter((r) => !status || r.status === status)
    .filter((r) => !needle || r.location.toLowerCase().includes(needle))
    .filter((r) => !completedOnly || COMPLETED_STATUSES.includes(r.status))
    .filter((r) => !openOnly || isOpen(r.status))
    .filter((r) => fromMs === null || new Date(r.updatedAt).getTime() >= fromMs)
    .filter((r) => toMs === null || new Date(r.updatedAt).getTime() <= toMs)
    .filter((r) => !completedBy || assigneeIdsOf(r.reportId).includes(completedBy))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(withPeople)
}

/** Mirrors GET /reports/{reportId} (report + assignments + thread). */
export async function getReport(reportId, { viewer } = {}) {
  await delay(200)
  const report = requireReport(reportId)
  if (viewer && !visibleTo(report, viewer)) {
    throw new ApiError(403, 'You do not have access to this report')
  }
  const activity = getDb()
    .activity.filter((a) => a.reportId === reportId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((a) => ({ ...a, author: getEmployeeSync(a.authorId) }))
  return { ...withPeople(report), activity }
}

/**
 * Pending approvals for a faculty admin's team (or every team for a global admin).
 * Mirrors GET /reports/requests?status=PENDING
 */
export async function listPendingRequests({ viewer }) {
  await delay(200)
  const db = getDb()
  const inScope = (reportId) => {
    const report = db.reports.find((r) => r.reportId === reportId)
    return report && visibleTo(report, viewer)
  }
  const reportSummary = (reportId) => {
    const report = db.reports.find((r) => r.reportId === reportId)
    return report ? withPeople(report) : null
  }
  return {
    assignmentRequests: db.assignmentRequests
      .filter((r) => r.status === 'PENDING' && inScope(r.reportId))
      .map((r) => ({ ...r, engineer: getEmployeeSync(r.engineerId), report: reportSummary(r.reportId) })),
    closeRequests: db.closeRequests
      .filter((r) => r.status === 'PENDING' && inScope(r.reportId))
      .map((r) => ({ ...r, requester: getEmployeeSync(r.requestedBy), report: reportSummary(r.reportId) })),
  }
}

/**
 * Stat tiles for the faculty admin dashboard.
 * Mirrors GET /reports/stats (team-scoped by the caller's token).
 */
export async function getDashboardStats({ viewer }) {
  await delay(200)
  const db = getDb()
  const visible = db.reports.filter((r) => visibleTo(r, viewer))
  const engineers = db.employees.filter(
    (e) =>
      e.role === Role.ENGINEER &&
      (viewer.scope === Scope.ALL || e.facultyAdminId === viewer.employeeId),
  )
  const busyIds = new Set(
    db.assignments
      .filter((a) => {
        const report = db.reports.find((r) => r.reportId === a.reportId)
        return report && ACTIVE_ASSIGNMENT_STATUSES.includes(report.status)
      })
      .map((a) => a.assigneeId),
  )
  const pending = await listPendingRequests({ viewer })
  return {
    incidentsToday: visible.filter((r) => sameDay(r.createdAt)).length,
    openCases: visible.filter((r) => isOpen(r.status)).length,
    unassigned: visible.filter((r) => r.status === ReportStatus.UNASSIGNED).length,
    availableEngineers: engineers.filter((e) => !busyIds.has(e.employeeId)).length,
    totalEngineers: engineers.length,
    pendingApprovals: pending.assignmentRequests.length + pending.closeRequests.length,
  }
}

// ---------------------------------------------------------------------------------------------
// Writes — employee
// ---------------------------------------------------------------------------------------------

/**
 * Create a report in UNASSIGNED authored by `author`.
 * Mirrors POST /reports { title, body, location } (incidentType/priority are client-side until
 * the backend adds them — see spec "Data model alignment").
 */
export async function createReport({ title, body, location, incidentType, priority }, author) {
  await delay(400)
  if (!title?.trim()) throw new ApiError(400, 'Title is required')
  if (!location?.trim()) throw new ApiError(400, 'Location is required')
  const now = new Date().toISOString()
  const report = {
    reportId: nextId('RPT'),
    title: title.trim(),
    body: (body ?? '').trim(),
    location: location.trim(),
    status: ReportStatus.UNASSIGNED,
    authorId: author.employeeId,
    incidentType,
    priority,
    createdAt: now,
    updatedAt: now,
  }
  getDb().reports.push(report)
  commit()
  return withPeople(report)
}

/** Mirrors POST /reports/{reportId}/comments { body } */
export async function addComment(reportId, body, author) {
  await delay(200)
  const report = requireReport(reportId)
  if (!body?.trim()) throw new ApiError(400, 'Comment cannot be empty')
  const entry = addActivity(report.reportId, 'comment', author.employeeId, body.trim())
  touch(report)
  commit()
  return { ...entry, author: getEmployeeSync(entry.authorId) }
}

/**
 * Author asks for the report to be closed. Does NOT archive — a Faculty Admin confirms.
 * Mirrors POST /reports/{reportId}/close-requests
 */
export async function requestClose(reportId, author) {
  await delay(300)
  const report = requireReport(reportId)
  if (report.authorId !== author.employeeId && !isFacultyAdmin(author)) {
    throw new ApiError(403, 'Only the report author can request a close')
  }
  if (report.status === ReportStatus.ARCHIVED) throw new ApiError(409, 'Report is already archived')
  const db = getDb()
  if (db.closeRequests.some((r) => r.reportId === reportId && r.status === 'PENDING')) {
    throw new ApiError(409, 'A close request is already awaiting confirmation')
  }
  const request = {
    requestId: nextId('CREQ'),
    reportId,
    requestedBy: author.employeeId,
    requestedAt: new Date().toISOString(),
    status: 'PENDING',
  }
  db.closeRequests.push(request)
  addActivity(reportId, 'request', author.employeeId, 'Requested to close this report')
  touch(report)
  commit()
  return request
}

// ---------------------------------------------------------------------------------------------
// Writes — engineer
// ---------------------------------------------------------------------------------------------

/**
 * Engineer asks to work an UNASSIGNED report. Routes to the Faculty Admin; does not self-assign.
 * Mirrors POST /reports/{reportId}/assignment-requests
 */
export async function requestAssignment(reportId, engineer) {
  await delay(300)
  const report = requireReport(reportId)
  if (engineer.role !== Role.ENGINEER || !visibleTo(report, engineer)) {
    throw new ApiError(403, 'Only an engineer on this team can request this report')
  }
  if (report.status !== ReportStatus.UNASSIGNED) {
    throw new ApiError(409, 'Only unassigned reports can be requested')
  }
  const db = getDb()
  if (
    db.assignmentRequests.some(
      (r) => r.reportId === reportId && r.engineerId === engineer.employeeId && r.status === 'PENDING',
    )
  ) {
    throw new ApiError(409, 'You have already requested this report')
  }
  const request = {
    requestId: nextId('AREQ'),
    reportId,
    engineerId: engineer.employeeId,
    requestedAt: new Date().toISOString(),
    status: 'PENDING',
  }
  db.assignmentRequests.push(request)
  addActivity(reportId, 'request', engineer.employeeId, 'Requested assignment')
  touch(report)
  commit()
  return request
}

/**
 * Move a report along its lifecycle (start work, submit, approve, send back, archive).
 * Mirrors PATCH /reports/{reportId}/status { status }
 */
export async function transitionReport(reportId, nextStatus, actor) {
  await delay(300)
  const report = requireReport(reportId)
  const isAssignee = assigneeIdsOf(reportId).includes(actor.employeeId)
  const adminOnly = [ReportStatus.APPROVED, ReportStatus.ARCHIVED, ReportStatus.UNASSIGNED]
  const sendingBack = report.status === ReportStatus.SUBMITTED && nextStatus === ReportStatus.IN_PROGRESS
  if ((adminOnly.includes(nextStatus) || sendingBack) && !isFacultyAdmin(actor)) {
    throw new ApiError(403, 'Only a Faculty Admin can perform this transition')
  }
  if (!isAssignee && !isFacultyAdmin(actor)) {
    throw new ApiError(403, 'Only an assigned engineer can change this report')
  }
  moveTo(report, nextStatus, actor.employeeId)
  commit()
  return withPeople(report)
}

// ---------------------------------------------------------------------------------------------
// Writes — faculty admin
// ---------------------------------------------------------------------------------------------

/**
 * Replace the set of engineers assigned to a report (assign or reassign).
 * Mirrors PUT /reports/{reportId}/assignees { engineerIds }
 * Keeps ReportStatus in step with the assignment table, per the backend's note that the two
 * describe the same fact from different sides.
 */
export async function assignEngineers(reportId, engineerIds, admin) {
  await delay(350)
  if (!isFacultyAdmin(admin)) throw new ApiError(403, 'Only a Faculty Admin can assign engineers')
  const report = requireReport(reportId)
  if (report.status === ReportStatus.ARCHIVED) throw new ApiError(409, 'Archived reports cannot be assigned')
  const db = getDb()
  const wanted = [...new Set(engineerIds)]
  for (const id of wanted) {
    // The admin themselves is allowed, as in ReportService: that is how a faculty admin takes a case.
    if (id === admin.employeeId) continue
    const engineer = db.employees.find((e) => e.employeeId === id)
    if (!engineer || engineer.role !== Role.ENGINEER) {
      throw new ApiError(400, `${id} is not you or an engineer`)
    }
  }

  const current = assigneeIdsOf(reportId)
  const removed = current.filter((id) => !wanted.includes(id))
  const added = wanted.filter((id) => !current.includes(id))

  db.assignments = db.assignments.filter(
    (a) => a.reportId !== reportId || !removed.includes(a.assigneeId),
  )
  const now = new Date().toISOString()
  for (const id of added) {
    db.assignments.push({
      reportId,
      assigneeId: id,
      accessLevel: 'CONTRIBUTOR',
      assignedBy: admin.employeeId,
      assignedAt: now,
    })
  }
  if (removed.length) {
    addActivity(reportId, 'assignment', admin.employeeId,
      `Unassigned ${removed.map((id) => getEmployeeSync(id).name).join(', ')}`)
  }
  if (added.length) {
    addActivity(reportId, 'assignment', admin.employeeId,
      `Assigned ${added.map((id) => getEmployeeSync(id).name).join(', ')}`)
  }

  // Any pending requests from engineers who are now assigned are implicitly approved.
  for (const r of db.assignmentRequests) {
    if (r.reportId === reportId && r.status === 'PENDING' && wanted.includes(r.engineerId)) {
      r.status = 'APPROVED'
    }
  }

  if (wanted.length && report.status === ReportStatus.UNASSIGNED) {
    moveTo(report, ReportStatus.ASSIGNED, admin.employeeId)
  } else if (!wanted.length && report.status === ReportStatus.ASSIGNED) {
    moveTo(report, ReportStatus.UNASSIGNED, admin.employeeId)
  } else {
    touch(report)
  }
  commit()
  return withPeople(report)
}

/** Mirrors POST /reports/assignment-requests/{requestId}/approve */
export async function approveAssignmentRequest(requestId, admin) {
  const request = getDb().assignmentRequests.find((r) => r.requestId === requestId)
  if (!request) throw new ApiError(404, 'Request not found')
  if (request.status !== 'PENDING') throw new ApiError(409, 'Request already resolved')
  const current = assigneeIdsOf(request.reportId)
  return assignEngineers(request.reportId, [...current, request.engineerId], admin)
}

/** Mirrors POST /reports/assignment-requests/{requestId}/decline */
export async function declineAssignmentRequest(requestId, admin) {
  await delay(250)
  if (!isFacultyAdmin(admin)) throw new ApiError(403, 'Only a Faculty Admin can decline requests')
  const request = getDb().assignmentRequests.find((r) => r.requestId === requestId)
  if (!request) throw new ApiError(404, 'Request not found')
  if (request.status !== 'PENDING') throw new ApiError(409, 'Request already resolved')
  request.status = 'DECLINED'
  addActivity(request.reportId, 'request', admin.employeeId,
    `Declined assignment request from ${getEmployeeSync(request.engineerId).name}`)
  commit()
  return request
}

/**
 * Confirm an author's close request: walks the report forward to ARCHIVED through the legal
 * transitions (e.g. SUBMITTED → APPROVED → ARCHIVED), recording each step. UNASSIGNED reports
 * cannot be archived this way — assign someone or decline instead.
 * Mirrors POST /reports/close-requests/{requestId}/approve
 */
export async function approveCloseRequest(requestId, admin) {
  await delay(350)
  if (!isFacultyAdmin(admin)) throw new ApiError(403, 'Only a Faculty Admin can confirm a close')
  const request = getDb().closeRequests.find((r) => r.requestId === requestId)
  if (!request) throw new ApiError(404, 'Request not found')
  if (request.status !== 'PENDING') throw new ApiError(409, 'Request already resolved')
  const report = requireReport(request.reportId)
  if (report.status === ReportStatus.UNASSIGNED) {
    throw new ApiError(409, 'Assign an engineer before closing, or decline the request')
  }
  const path = {
    [ReportStatus.ASSIGNED]: [ReportStatus.IN_PROGRESS, ReportStatus.SUBMITTED, ReportStatus.APPROVED, ReportStatus.ARCHIVED],
    [ReportStatus.IN_PROGRESS]: [ReportStatus.SUBMITTED, ReportStatus.APPROVED, ReportStatus.ARCHIVED],
    [ReportStatus.SUBMITTED]: [ReportStatus.APPROVED, ReportStatus.ARCHIVED],
    [ReportStatus.APPROVED]: [ReportStatus.ARCHIVED],
    [ReportStatus.ARCHIVED]: [],
  }[report.status]
  for (const next of path) moveTo(report, next, admin.employeeId)
  request.status = 'APPROVED'
  addActivity(report.reportId, 'request', admin.employeeId, 'Confirmed close request')
  commit()
  return withPeople(report)
}

/** Mirrors POST /reports/close-requests/{requestId}/decline */
export async function declineCloseRequest(requestId, admin) {
  await delay(250)
  if (!isFacultyAdmin(admin)) throw new ApiError(403, 'Only a Faculty Admin can decline requests')
  const request = getDb().closeRequests.find((r) => r.requestId === requestId)
  if (!request) throw new ApiError(404, 'Request not found')
  if (request.status !== 'PENDING') throw new ApiError(409, 'Request already resolved')
  request.status = 'DECLINED'
  addActivity(request.reportId, 'request', admin.employeeId, 'Declined close request')
  commit()
  return request
}
