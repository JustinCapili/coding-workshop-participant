/**
 * Seed data for the mock API layer. Loaded only when VITE_USE_MOCKS=true.
 *
 * Shapes mirror the backend where a backend type exists:
 *   - employees      -> Employee / Engineer / FacultyAdmin (+ frontend-only `role`, `scope`, `name`)
 *   - reports        -> Report (reportId, title, body, location, status, authorId, createdAt, updatedAt)
 *                       plus client-side stopgap fields `incidentType` and `priority`
 *   - assignments    -> ReportAssignment (reportId, assigneeId, accessLevel, assignedBy, assignedAt)
 * The remaining collections (comments/events and the two request queues) have no backend
 * counterpart yet — see spec Open Question 5.
 *
 * Timestamps are computed relative to "now" so the "incidents today" tile is never empty.
 */
import { ReportStatus } from '../../domain/reportStatus'
import { Role, Scope } from '../../domain/roles'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const now = Date.now()
const ago = (ms) => new Date(now - ms).toISOString()

export const DEMO_PASSWORD = 'password'

/** Every account below logs in with DEMO_PASSWORD. Employees carry a `facultyAdminId` (their team). */
export const employees = [
  {
    employeeId: 'EMP-001',
    email: 'alice@acme.com',
    name: 'Alice Nguyen',
    role: Role.EMPLOYEE,
    facultyAdminId: 'FA-001',
  },
  {
    employeeId: 'EMP-002',
    email: 'eric@acme.com',
    name: 'Eric Okafor',
    role: Role.EMPLOYEE,
    facultyAdminId: 'FA-002',
  },
  {
    employeeId: 'ENG-001',
    email: 'bob@acme.com',
    name: 'Bob Martinez',
    role: Role.ENGINEER,
    facultyAdminId: 'FA-001',
  },
  {
    employeeId: 'ENG-002',
    email: 'carol@acme.com',
    name: 'Carol Singh',
    role: Role.ENGINEER,
    facultyAdminId: 'FA-001',
  },
  {
    employeeId: 'ENG-003',
    email: 'dave@acme.com',
    name: 'Dave Kowalski',
    role: Role.ENGINEER,
    facultyAdminId: 'FA-002',
  },
  {
    employeeId: 'FA-001',
    email: 'frank@acme.com',
    name: 'Frank Delgado',
    role: Role.FACULTY_ADMIN,
    scope: Scope.TEAM,
    facultyAdminId: 'FA-001',
  },
  {
    employeeId: 'FA-002',
    email: 'grace@acme.com',
    name: 'Grace Chen',
    role: Role.FACULTY_ADMIN,
    scope: Scope.TEAM,
    facultyAdminId: 'FA-002',
  },
  {
    employeeId: 'ADM-001',
    email: 'admin@acme.com',
    name: 'Ada Whitfield',
    role: Role.FACULTY_ADMIN,
    scope: Scope.ALL,
    facultyAdminId: 'ADM-001',
  },
]

export const reports = [
  {
    reportId: 'RPT-1001',
    title: 'Projector in Room 204 not powering on',
    body: 'The ceiling projector shows no power light. Tried the wall switch and the remote.',
    location: 'Building A, Room 204',
    status: ReportStatus.IN_PROGRESS,
    authorId: 'EMP-001',
    incidentType: 'IT',
    priority: 'MEDIUM',
    createdAt: ago(2 * DAY),
    updatedAt: ago(5 * HOUR),
  },
  {
    reportId: 'RPT-1002',
    title: 'Water leak under sink in 3rd floor kitchenette',
    body: 'Slow drip from the U-bend. A bucket is in place for now.',
    location: 'Building A, Floor 3 kitchenette',
    status: ReportStatus.UNASSIGNED,
    authorId: 'EMP-001',
    incidentType: 'FACILITIES',
    priority: 'HIGH',
    createdAt: ago(3 * HOUR),
    updatedAt: ago(3 * HOUR),
  },
  {
    reportId: 'RPT-1003',
    title: 'Emergency exit sign flickering',
    body: 'The illuminated exit sign by the east stairwell flickers constantly.',
    location: 'Building B, East stairwell, Floor 1',
    status: ReportStatus.ASSIGNED,
    authorId: 'EMP-002',
    incidentType: 'SAFETY',
    priority: 'CRITICAL',
    createdAt: ago(1 * DAY + 2 * HOUR),
    updatedAt: ago(20 * HOUR),
  },
  {
    reportId: 'RPT-1004',
    title: 'Wi-Fi drops every few minutes in lecture hall',
    body: 'Devices in the back rows lose connection roughly every 5 minutes.',
    location: 'Building A, Lecture Hall 1',
    status: ReportStatus.SUBMITTED,
    authorId: 'EMP-001',
    incidentType: 'IT',
    priority: 'HIGH',
    createdAt: ago(4 * DAY),
    updatedAt: ago(6 * HOUR),
  },
  {
    reportId: 'RPT-1005',
    title: 'Broken chair in Room 110',
    body: 'One of the swivel chairs has a cracked base and tips over.',
    location: 'Building A, Room 110',
    status: ReportStatus.APPROVED,
    authorId: 'EMP-001',
    incidentType: 'FACILITIES',
    priority: 'LOW',
    createdAt: ago(9 * DAY),
    updatedAt: ago(2 * DAY),
  },
  {
    reportId: 'RPT-1006',
    title: 'HVAC too cold in server room',
    body: 'Server room thermostat reads 14°C; set point should be 20°C.',
    location: 'Building B, Server Room B-02',
    status: ReportStatus.ARCHIVED,
    authorId: 'EMP-002',
    incidentType: 'FACILITIES',
    priority: 'MEDIUM',
    createdAt: ago(20 * DAY),
    updatedAt: ago(15 * DAY),
  },
  {
    reportId: 'RPT-1007',
    title: 'Printer jams on every duplex job',
    body: 'The shared printer on floor 2 jams whenever double-sided printing is selected.',
    location: 'Building A, Floor 2 print room',
    status: ReportStatus.ARCHIVED,
    authorId: 'EMP-001',
    incidentType: 'IT',
    priority: 'LOW',
    createdAt: ago(31 * DAY),
    updatedAt: ago(27 * DAY),
  },
  {
    reportId: 'RPT-1008',
    title: 'Card reader not accepting staff badges',
    body: 'Side entrance badge reader beeps red for all staff since this morning.',
    location: 'Building B, Side entrance',
    status: ReportStatus.UNASSIGNED,
    authorId: 'EMP-002',
    incidentType: 'SAFETY',
    priority: 'HIGH',
    createdAt: ago(1 * HOUR),
    updatedAt: ago(1 * HOUR),
  },
]

/** AccessLevel values mirror the backend enum; ADMIN is never stored as a grant. */
export const assignments = [
  { reportId: 'RPT-1001', assigneeId: 'ENG-001', accessLevel: 'CONTRIBUTOR', assignedBy: 'FA-001', assignedAt: ago(1 * DAY + 20 * HOUR) },
  { reportId: 'RPT-1003', assigneeId: 'ENG-003', accessLevel: 'CONTRIBUTOR', assignedBy: 'FA-002', assignedAt: ago(20 * HOUR) },
  { reportId: 'RPT-1004', assigneeId: 'ENG-002', accessLevel: 'CONTRIBUTOR', assignedBy: 'FA-001', assignedAt: ago(3 * DAY + 12 * HOUR) },
  { reportId: 'RPT-1005', assigneeId: 'ENG-001', accessLevel: 'CONTRIBUTOR', assignedBy: 'FA-001', assignedAt: ago(8 * DAY) },
  { reportId: 'RPT-1006', assigneeId: 'ENG-003', accessLevel: 'CONTRIBUTOR', assignedBy: 'FA-002', assignedAt: ago(19 * DAY) },
  { reportId: 'RPT-1007', assigneeId: 'ENG-002', accessLevel: 'CONTRIBUTOR', assignedBy: 'FA-001', assignedAt: ago(30 * DAY) },
]

/**
 * Activity thread entries. `kind` is one of:
 *   comment | status | assignment | request
 * Status/assignment/request entries are system events rendered inline with comments.
 */
export const activity = [
  { activityId: 'ACT-1', reportId: 'RPT-1001', kind: 'comment', authorId: 'EMP-001', body: 'It was working yesterday afternoon.', createdAt: ago(2 * DAY - HOUR) },
  { activityId: 'ACT-2', reportId: 'RPT-1001', kind: 'assignment', authorId: 'FA-001', body: 'Assigned Bob Martinez', createdAt: ago(1 * DAY + 20 * HOUR) },
  { activityId: 'ACT-3', reportId: 'RPT-1001', kind: 'status', authorId: 'FA-001', body: 'UNASSIGNED → ASSIGNED', createdAt: ago(1 * DAY + 20 * HOUR) },
  { activityId: 'ACT-4', reportId: 'RPT-1001', kind: 'status', authorId: 'ENG-001', body: 'ASSIGNED → IN_PROGRESS', createdAt: ago(1 * DAY) },
  { activityId: 'ACT-5', reportId: 'RPT-1001', kind: 'comment', authorId: 'ENG-001', body: 'Power supply looks dead. Ordering a replacement lamp module.', createdAt: ago(5 * HOUR) },

  { activityId: 'ACT-6', reportId: 'RPT-1002', kind: 'request', authorId: 'ENG-002', body: 'Requested assignment', createdAt: ago(2 * HOUR) },

  { activityId: 'ACT-7', reportId: 'RPT-1003', kind: 'assignment', authorId: 'FA-002', body: 'Assigned Dave Kowalski', createdAt: ago(20 * HOUR) },
  { activityId: 'ACT-8', reportId: 'RPT-1003', kind: 'status', authorId: 'FA-002', body: 'UNASSIGNED → ASSIGNED', createdAt: ago(20 * HOUR) },

  { activityId: 'ACT-9', reportId: 'RPT-1004', kind: 'assignment', authorId: 'FA-001', body: 'Assigned Carol Singh', createdAt: ago(3 * DAY + 12 * HOUR) },
  { activityId: 'ACT-10', reportId: 'RPT-1004', kind: 'status', authorId: 'FA-001', body: 'UNASSIGNED → ASSIGNED', createdAt: ago(3 * DAY + 12 * HOUR) },
  { activityId: 'ACT-11', reportId: 'RPT-1004', kind: 'status', authorId: 'ENG-002', body: 'ASSIGNED → IN_PROGRESS', createdAt: ago(3 * DAY) },
  { activityId: 'ACT-12', reportId: 'RPT-1004', kind: 'comment', authorId: 'ENG-002', body: 'Replaced the access point; channel overlap with the neighbouring AP was the cause.', createdAt: ago(7 * HOUR) },
  { activityId: 'ACT-13', reportId: 'RPT-1004', kind: 'status', authorId: 'ENG-002', body: 'IN_PROGRESS → SUBMITTED', createdAt: ago(6 * HOUR) },
  { activityId: 'ACT-14', reportId: 'RPT-1004', kind: 'request', authorId: 'EMP-001', body: 'Requested to close this report', createdAt: ago(4 * HOUR) },

  { activityId: 'ACT-15', reportId: 'RPT-1005', kind: 'comment', authorId: 'ENG-001', body: 'Swapped the chair with a spare from storage.', createdAt: ago(3 * DAY) },
  { activityId: 'ACT-16', reportId: 'RPT-1005', kind: 'status', authorId: 'FA-001', body: 'SUBMITTED → APPROVED', createdAt: ago(2 * DAY) },

  { activityId: 'ACT-17', reportId: 'RPT-1006', kind: 'comment', authorId: 'ENG-003', body: 'Thermostat sensor had drifted; recalibrated and verified overnight.', createdAt: ago(16 * DAY) },
  { activityId: 'ACT-18', reportId: 'RPT-1006', kind: 'status', authorId: 'FA-002', body: 'APPROVED → ARCHIVED', createdAt: ago(15 * DAY) },

  { activityId: 'ACT-19', reportId: 'RPT-1007', kind: 'comment', authorId: 'ENG-002', body: 'Duplex unit rollers were worn. Replaced and test-printed 50 pages.', createdAt: ago(28 * DAY) },
  { activityId: 'ACT-20', reportId: 'RPT-1007', kind: 'status', authorId: 'FA-001', body: 'APPROVED → ARCHIVED', createdAt: ago(27 * DAY) },
]

/** Engineer "let me work this" requests awaiting a Faculty Admin. */
export const assignmentRequests = [
  { requestId: 'AREQ-1', reportId: 'RPT-1002', engineerId: 'ENG-002', requestedAt: ago(2 * HOUR), status: 'PENDING' },
]

/** Author "please close this" requests awaiting a Faculty Admin. */
export const closeRequests = [
  { requestId: 'CREQ-1', reportId: 'RPT-1004', requestedBy: 'EMP-001', requestedAt: ago(4 * HOUR), status: 'PENDING' },
]
