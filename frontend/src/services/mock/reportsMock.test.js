/**
 * The mock backend's report rules, against the seeded fixtures. Who is who:
 *   team FA-001: alice (employee), bob and carol (engineers), frank (faculty admin)
 *   team FA-002: eric (employee), dave (engineer), grace (faculty admin)
 *   admin@acme.inc: a faculty admin with ALL scope
 * Alice wrote RPT-1001/1002/1004/1005/1007 and Eric RPT-1003/1006/1008.
 */
import { ALLOWED_NEXT, REPORT_STATUSES, ReportStatus } from '../../domain/reportStatus'
import { Role } from '../../domain/roles'
import { seededUser } from '../../test/renderApp'
import { ApiError } from '../apiError'
import { getDb } from './mockStore'
import {
  addComment,
  approveAssignmentRequest,
  approveCloseRequest,
  assignEngineers,
  createReport,
  declineAssignmentRequest,
  declineCloseRequest,
  getDashboardStats,
  getReport,
  listPendingRequests,
  listReports,
  requestAssignment,
  requestClose,
  transitionReport,
} from './reportsMock'

const { UNASSIGNED, ASSIGNED, IN_PROGRESS, SUBMITTED, APPROVED, ARCHIVED } = ReportStatus

const alice = seededUser('alice@acme.com')
const eric = seededUser('eric@acme.com')
const bob = seededUser('bob@acme.com')
const carol = seededUser('carol@acme.com')
const dave = seededUser('dave@acme.com')
const frank = seededUser('frank@acme.com')
const grace = seededUser('grace@acme.com')
const admin = seededUser('admin@acme.inc')

// Newest first, as listReports sorts them.
const TEAM_1 = ['RPT-1002', 'RPT-1001', 'RPT-1004', 'RPT-1005', 'RPT-1007']
const TEAM_2 = ['RPT-1008', 'RPT-1003', 'RPT-1006']
const ALL = ['RPT-1008', 'RPT-1002', 'RPT-1001', 'RPT-1004', 'RPT-1003', 'RPT-1005', 'RPT-1006', 'RPT-1007']

const ids = (list) => list.map((r) => r.reportId)
const visibleTo = async (viewer, filters = {}) => ids(await listReports({ viewer, ...filters }))
const row = (reportId) => getDb().reports.find((r) => r.reportId === reportId)
const thread = (reportId) => getDb().activity.filter((a) => a.reportId === reportId)
const lastEntry = (reportId) => thread(reportId).at(-1)
const assigneesOf = (reportId) =>
  getDb().assignments.filter((a) => a.reportId === reportId).map((a) => a.assigneeId)
const areq = (requestId) => getDb().assignmentRequests.find((r) => r.requestId === requestId)
const creq = (requestId) => getDb().closeRequests.find((r) => r.requestId === requestId)
const persisted = () => JSON.parse(window.localStorage.getItem('acme-incident-mock-db-v1'))
const removeEmployee = (employeeId) => {
  getDb().employees = getDb().employees.filter((e) => e.employeeId !== employeeId)
}

async function rejection(promise) {
  const err = await promise.catch((e) => e)
  expect(err).toBeInstanceOf(ApiError)
  return err
}

// ---------------------------------------------------------------------------------------------

describe('visibility', () => {
  it.each([
    ['an employee sees only their own reports', alice, TEAM_1],
    ['another employee sees only theirs', eric, TEAM_2],
    ['an engineer sees their team, assigned or not', bob, TEAM_1],
    ['every engineer on a team sees the same', carol, TEAM_1],
    ['an engineer on the other team sees that team', dave, TEAM_2],
    ['a faculty admin sees their team', frank, TEAM_1],
    ['the other faculty admin sees theirs', grace, TEAM_2],
    ['an ALL-scope admin sees everything', admin, ALL],
  ])('%s', async (_case, viewer, expected) => {
    expect(await visibleTo(viewer)).toEqual(expected)
  })

  it('shows nothing with nobody signed in', async () => {
    await expect(listReports()).resolves.toEqual([])
    await expect(listReports({})).resolves.toEqual([])
  })

  it('shows a viewer of an unknown role only what they wrote', async () => {
    expect(await visibleTo({ ...alice, role: 'GUEST' })).toEqual(TEAM_1)
    expect(await visibleTo({ employeeId: 'X-1', role: 'GUEST' })).toEqual([])
  })

  it('shares a report by a teamless author with every engineer and faculty admin, not other employees', async () => {
    getDb().employees.push({
      employeeId: 'EMP-SOLO', email: 'solo@acme.com', name: 'Solo', role: Role.EMPLOYEE, facultyAdminId: null,
    })
    const solo = { employeeId: 'EMP-SOLO', role: Role.EMPLOYEE, facultyAdminId: null }
    const created = await createReport({ title: 'Lonely', location: 'Annex' }, solo)

    for (const viewer of [solo, bob, dave, frank, grace, admin]) {
      expect(await visibleTo(viewer)).toContain(created.reportId)
    }
    for (const viewer of [alice, eric]) {
      expect(await visibleTo(viewer)).not.toContain(created.reportId)
    }
  })

  it('does not share the reports of an author who no longer exists', async () => {
    removeEmployee('EMP-002')

    // RPT-1003 and RPT-1006 stay on team 2 through Dave's grants; RPT-1008 has nobody on it.
    expect(await visibleTo(grace)).toEqual(['RPT-1003', 'RPT-1006'])
    expect(await visibleTo(frank)).toEqual(TEAM_1)
    expect(await visibleTo(admin)).toEqual(ALL)
  })

  it('brings a report into a team when one of its engineers is assigned', async () => {
    getDb().assignments.push({ reportId: 'RPT-1008', assigneeId: 'ENG-001' })

    expect(await visibleTo(frank)).toContain('RPT-1008')
    expect(await visibleTo(carol)).toContain('RPT-1008')
    expect(await visibleTo(grace)).toContain('RPT-1008')
  })

  it("puts a faculty admin's own report on their team", async () => {
    const created = await createReport({ title: 'Admin-filed', location: 'Office' }, grace)

    expect(await visibleTo(dave)).toContain(created.reportId)
    expect(await visibleTo(bob)).not.toContain(created.reportId)
    expect(await visibleTo(frank)).not.toContain(created.reportId)
  })

  it('shows an engineer on no team only the reports assigned to them', async () => {
    const teamless = { ...carol, facultyAdminId: null }
    getDb().employees.find((e) => e.employeeId === 'ENG-002').facultyAdminId = null

    expect(await visibleTo(teamless)).toEqual(['RPT-1004', 'RPT-1007'])
  })
})

describe('listReports filters', () => {
  it('filters by exact status', async () => {
    expect(await visibleTo(admin, { status: UNASSIGNED })).toEqual(['RPT-1008', 'RPT-1002'])
  })

  it('matches a location substring, ignoring case and surrounding spaces', async () => {
    expect(await visibleTo(admin, { location: '  building B ' })).toEqual(TEAM_2)
  })

  it('restricts to completed or to open reports', async () => {
    expect(await visibleTo(admin, { completedOnly: true })).toEqual(['RPT-1005', 'RPT-1006', 'RPT-1007'])
    expect(await visibleTo(admin, { openOnly: true })).toEqual(
      ALL.filter((id) => !['RPT-1006', 'RPT-1007'].includes(id)),
    )
  })

  it('bounds updatedAt by date, the "to" day included whole', async () => {
    row('RPT-1001').updatedAt = '2000-01-09T12:00:00.000Z'
    row('RPT-1002').updatedAt = '2000-01-10T23:30:00.000Z'
    row('RPT-1004').updatedAt = '2000-01-11T00:00:00.000Z'

    expect(await visibleTo(admin, { from: '2000-01-10', to: '2000-01-10' })).toEqual(['RPT-1002'])
    expect(await visibleTo(admin, { to: '2000-01-10' })).toEqual(['RPT-1002', 'RPT-1001'])
    expect(await visibleTo(admin, { from: '2000-01-10' })).not.toContain('RPT-1001')
    expect(await visibleTo(admin, { from: '2000-01-10' })).toHaveLength(7)
  })

  it('filters by an engineer holding a grant, alone or with other filters', async () => {
    expect(await visibleTo(admin, { completedBy: 'ENG-001' })).toEqual(['RPT-1001', 'RPT-1005'])
    expect(await visibleTo(admin, { completedBy: 'ENG-001', completedOnly: true })).toEqual(['RPT-1005'])
    expect(await visibleTo(bob, { status: ARCHIVED, location: 'print' })).toEqual(['RPT-1007'])
  })

  it('returns each report with its people and pending requests', async () => {
    const list = await listReports({ viewer: frank })
    const leak = list.find((r) => r.reportId === 'RPT-1002')
    const wifi = list.find((r) => r.reportId === 'RPT-1004')

    expect(leak).toMatchObject({ status: UNASSIGNED, author: alice, assignees: [], pendingCloseRequest: null })
    expect(leak.pendingAssignmentRequests).toEqual([
      expect.objectContaining({ requestId: 'AREQ-1', engineerId: 'ENG-002', engineer: carol }),
    ])
    expect(wifi.assignees).toEqual([
      expect.objectContaining({ assigneeId: 'ENG-002', accessLevel: 'CONTRIBUTOR', employee: carol }),
    ])
    expect(wifi.pendingCloseRequest).toMatchObject({ requestId: 'CREQ-1', status: 'PENDING' })
    expect(wifi.pendingAssignmentRequests).toEqual([])
  })
})

describe('getReport', () => {
  it('returns the report with its thread, oldest entry first', async () => {
    const report = await getReport('RPT-1001', { viewer: alice })

    expect(report).toMatchObject({ reportId: 'RPT-1001', author: alice, assignees: [expect.objectContaining({ employee: bob })] })
    expect(report.activity.map((a) => a.activityId)).toEqual(['ACT-1', 'ACT-2', 'ACT-3', 'ACT-4', 'ACT-5'])
    expect(report.activity[4]).toMatchObject({ kind: 'comment', author: bob })
  })

  it('checks nothing when no viewer is given', async () => {
    await expect(getReport('RPT-1003')).resolves.toMatchObject({ reportId: 'RPT-1003' })
  })

  it('answers 404 for an unknown report', async () => {
    const err = await rejection(getReport('RPT-404', { viewer: admin }))
    expect(err).toMatchObject({ status: 404, message: 'Report RPT-404 not found' })
  })

  it('answers 403 for a report the viewer may not see', async () => {
    const err = await rejection(getReport('RPT-1001', { viewer: eric }))
    expect(err).toMatchObject({ status: 403, message: 'You do not have access to this report' })
  })

  it('names a departed author "Former employee"', async () => {
    removeEmployee('EMP-001')
    const report = await getReport('RPT-1001')
    expect(report.author).toEqual({ employeeId: 'EMP-001', name: 'Former employee', email: '' })
    expect(report.activity[0].author.name).toBe('Former employee')
  })
})

describe('listPendingRequests', () => {
  it("lists a faculty admin's team queue with the people and report attached", async () => {
    const { assignmentRequests, closeRequests } = await listPendingRequests({ viewer: frank })

    expect(assignmentRequests).toEqual([
      expect.objectContaining({
        requestId: 'AREQ-1',
        engineer: carol,
        report: expect.objectContaining({ reportId: 'RPT-1002', author: alice }),
      }),
    ])
    expect(closeRequests).toEqual([
      expect.objectContaining({
        requestId: 'CREQ-1',
        requester: alice,
        report: expect.objectContaining({ reportId: 'RPT-1004' }),
      }),
    ])
  })

  it('is empty for a team with nothing pending, and everything for an ALL-scope admin', async () => {
    await expect(listPendingRequests({ viewer: grace })).resolves.toEqual({
      assignmentRequests: [],
      closeRequests: [],
    })
    const all = await listPendingRequests({ viewer: admin })
    expect(all.assignmentRequests).toHaveLength(1)
    expect(all.closeRequests).toHaveLength(1)
  })

  it('leaves out decided requests and requests on reports that no longer exist', async () => {
    areq('AREQ-1').status = 'DECLINED'
    creq('CREQ-1').status = 'APPROVED'
    getDb().assignmentRequests.push({ requestId: 'AREQ-X', reportId: 'RPT-GONE', engineerId: 'ENG-001', status: 'PENDING' })

    await expect(listPendingRequests({ viewer: admin })).resolves.toEqual({
      assignmentRequests: [],
      closeRequests: [],
    })
  })
})

describe('getDashboardStats', () => {
  beforeEach(() => {
    // Seeded timestamps are relative to now, so "today" depends on the clock; pin it down.
    for (const report of getDb().reports) report.createdAt = '2000-01-01T00:00:00.000Z'
    row('RPT-1002').createdAt = new Date().toISOString()
    row('RPT-1008').createdAt = new Date().toISOString()
  })

  it("counts a faculty admin's team", async () => {
    await expect(getDashboardStats({ viewer: frank })).resolves.toEqual({
      incidentsToday: 1,
      openCases: 4,
      unassigned: 1,
      availableEngineers: 1, // Bob is busy on RPT-1001 (IN_PROGRESS); Carol's RPT-1004 is SUBMITTED
      totalEngineers: 2,
      pendingApprovals: 2,
    })
  })

  it('counts the other team', async () => {
    await expect(getDashboardStats({ viewer: grace })).resolves.toEqual({
      incidentsToday: 1,
      openCases: 2,
      unassigned: 1,
      availableEngineers: 0, // Dave is busy on RPT-1003 (ASSIGNED)
      totalEngineers: 1,
      pendingApprovals: 0,
    })
  })

  it('counts everything for an ALL-scope admin', async () => {
    getDb().assignments.push({ reportId: 'RPT-GONE', assigneeId: 'ENG-002' })

    await expect(getDashboardStats({ viewer: admin })).resolves.toEqual({
      incidentsToday: 2,
      openCases: 6,
      unassigned: 2,
      availableEngineers: 1,
      totalEngineers: 3,
      pendingApprovals: 2,
    })
  })
})

// ---------------------------------------------------------------------------------------------

describe('createReport', () => {
  it('files a trimmed UNASSIGNED report by the author and persists it', async () => {
    const created = await createReport(
      { title: '  Broken window ', body: ' Cracked pane ', location: ' Room 12 ', incidentType: 'SAFETY', priority: 'HIGH' },
      alice,
    )

    expect(created).toEqual({
      reportId: expect.stringMatching(/^RPT-\d+$/),
      title: 'Broken window',
      body: 'Cracked pane',
      location: 'Room 12',
      status: UNASSIGNED,
      authorId: 'EMP-001',
      incidentType: 'SAFETY',
      priority: 'HIGH',
      createdAt: expect.any(String),
      updatedAt: created.createdAt,
      author: alice,
      assignees: [],
      pendingAssignmentRequests: [],
      pendingCloseRequest: null,
    })
    expect(persisted().reports.map((r) => r.reportId)).toContain(created.reportId)
    expect((await visibleTo(alice))[0]).toBe(created.reportId)
    expect(await visibleTo(frank)).toContain(created.reportId)
  })

  it('allows an empty body', async () => {
    const created = await createReport({ title: 'T', location: 'L' }, alice)
    expect(created.body).toBe('')
  })

  it.each([
    [{ title: '   ', location: 'L' }, 'Title is required'],
    [{ location: 'L' }, 'Title is required'],
    [{ title: 'T', location: ' ' }, 'Location is required'],
    [{ title: 'T' }, 'Location is required'],
  ])('rejects %o with a 400', async (fields, message) => {
    const err = await rejection(createReport(fields, alice))
    expect(err).toMatchObject({ status: 400, message })
  })
})

describe('addComment', () => {
  it('adds a trimmed comment to the end of the thread and touches the report', async () => {
    const before = row('RPT-1001').updatedAt
    const entry = await addComment('RPT-1001', '  Lamp arrived. ', bob)

    expect(entry).toEqual({
      activityId: expect.stringMatching(/^ACT-\d+$/),
      reportId: 'RPT-1001',
      kind: 'comment',
      authorId: 'ENG-001',
      body: 'Lamp arrived.',
      createdAt: expect.any(String),
      author: bob,
    })
    expect(row('RPT-1001').updatedAt > before).toBe(true)
    expect((await getReport('RPT-1001')).activity.at(-1).activityId).toBe(entry.activityId)
    expect(persisted().activity.at(-1).activityId).toBe(entry.activityId)
  })

  it('answers 404 for an unknown report', async () => {
    const err = await rejection(addComment('RPT-404', 'hi', bob))
    expect(err.status).toBe(404)
  })

  it.each(['', '   ', undefined])('rejects the empty comment %p with a 400', async (body) => {
    const err = await rejection(addComment('RPT-1001', body, bob))
    expect(err).toMatchObject({ status: 400, message: 'Comment cannot be empty' })
  })
})

describe('requestClose', () => {
  it('records a pending close request from the author without archiving', async () => {
    const request = await requestClose('RPT-1001', alice)

    expect(request).toEqual({
      requestId: expect.stringMatching(/^CREQ-\d+$/),
      reportId: 'RPT-1001',
      requestedBy: 'EMP-001',
      requestedAt: expect.any(String),
      status: 'PENDING',
    })
    expect(row('RPT-1001').status).toBe(IN_PROGRESS)
    expect(lastEntry('RPT-1001')).toMatchObject({ kind: 'request', authorId: 'EMP-001', body: 'Requested to close this report' })
    expect((await getReport('RPT-1001')).pendingCloseRequest).toEqual(request)
  })

  it('lets a faculty admin ask on the author’s behalf', async () => {
    await expect(requestClose('RPT-1002', frank)).resolves.toMatchObject({ requestedBy: 'FA-001' })
  })

  it('answers 404 for an unknown report', async () => {
    expect((await rejection(requestClose('RPT-404', alice))).status).toBe(404)
  })

  it('refuses anyone else with a 403', async () => {
    const err = await rejection(requestClose('RPT-1001', bob))
    expect(err).toMatchObject({ status: 403, message: 'Only the report author can request a close' })
  })

  it('refuses an archived report with a 409', async () => {
    const err = await rejection(requestClose('RPT-1007', alice))
    expect(err).toMatchObject({ status: 409, message: 'Report is already archived' })
  })

  it('refuses a second request while one is pending, with a 409', async () => {
    const err = await rejection(requestClose('RPT-1004', alice))
    expect(err).toMatchObject({ status: 409, message: 'A close request is already awaiting confirmation' })
  })
})

describe('requestAssignment', () => {
  it('records a pending request routed to the faculty admin, without assigning', async () => {
    const request = await requestAssignment('RPT-1002', bob)

    expect(request).toEqual({
      requestId: expect.stringMatching(/^AREQ-\d+$/),
      reportId: 'RPT-1002',
      engineerId: 'ENG-001',
      requestedAt: expect.any(String),
      status: 'PENDING',
    })
    expect(row('RPT-1002').status).toBe(UNASSIGNED)
    expect(assigneesOf('RPT-1002')).toEqual([])
    expect(lastEntry('RPT-1002')).toMatchObject({ kind: 'request', authorId: 'ENG-001', body: 'Requested assignment' })
    const pending = (await getReport('RPT-1002')).pendingAssignmentRequests
    expect(pending.map((r) => r.engineerId)).toEqual(['ENG-002', 'ENG-001'])
  })

  it('answers 404 for an unknown report', async () => {
    expect((await rejection(requestAssignment('RPT-404', bob))).status).toBe(404)
  })

  it.each([
    ['a faculty admin', frank],
    ['an employee', alice],
    ['an engineer on another team', dave],
  ])('refuses %s with a 403', async (_case, who) => {
    const err = await rejection(requestAssignment('RPT-1002', who))
    expect(err).toMatchObject({ status: 403, message: 'Only an engineer on this team can request this report' })
  })

  it('refuses a report that is not UNASSIGNED with a 409', async () => {
    const err = await rejection(requestAssignment('RPT-1001', carol))
    expect(err).toMatchObject({ status: 409, message: 'Only unassigned reports can be requested' })
  })

  it('refuses a repeat request with a 409', async () => {
    const err = await rejection(requestAssignment('RPT-1002', carol))
    expect(err).toMatchObject({ status: 409, message: 'You have already requested this report' })
  })
})

describe('transitionReport', () => {
  const LEGAL = [
    [UNASSIGNED, ASSIGNED],
    [ASSIGNED, IN_PROGRESS],
    [ASSIGNED, UNASSIGNED],
    [IN_PROGRESS, SUBMITTED],
    [SUBMITTED, APPROVED],
    [SUBMITTED, IN_PROGRESS],
    [APPROVED, ARCHIVED],
  ]
  const isLegal = (from, to) => LEGAL.some(([f, t]) => f === from && t === to)
  const allPairs = REPORT_STATUSES.flatMap((from) => REPORT_STATUSES.map((to) => [from, to]))

  it.each(allPairs)('a faculty admin moving %s to %s follows ALLOWED_NEXT', async (from, to) => {
    row('RPT-1001').status = from
    const entries = thread('RPT-1001').length

    if (isLegal(from, to)) {
      const report = await transitionReport('RPT-1001', to, admin)
      expect(report).toMatchObject({ status: to, assignees: [expect.objectContaining({ employee: bob })] })
      expect(lastEntry('RPT-1001')).toMatchObject({ kind: 'status', authorId: 'ADM-001', body: `${from} → ${to}` })
      expect(persisted().reports.find((r) => r.reportId === 'RPT-1001').status).toBe(to)
    } else {
      const err = await rejection(transitionReport('RPT-1001', to, admin))
      const allowed = ALLOWED_NEXT[from].join(', ') || 'none'
      expect(err).toMatchObject({
        status: 409,
        message: `Cannot move report from ${from} to ${to}; allowed: ${allowed}`,
      })
      expect(row('RPT-1001').status).toBe(from)
      expect(thread('RPT-1001')).toHaveLength(entries)
    }
  })

  it('refuses any move from a status it does not know', async () => {
    row('RPT-1001').status = 'LOST'
    const err = await rejection(transitionReport('RPT-1001', ASSIGNED, admin))
    expect(err).toMatchObject({ status: 409, message: 'Cannot move report from LOST to ASSIGNED; allowed: none' })
  })

  it('lets an assigned engineer start and submit work', async () => {
    await expect(transitionReport('RPT-1003', IN_PROGRESS, dave)).resolves.toMatchObject({ status: IN_PROGRESS })
    await expect(transitionReport('RPT-1001', SUBMITTED, bob)).resolves.toMatchObject({ status: SUBMITTED })
    expect(lastEntry('RPT-1001')).toMatchObject({ authorId: 'ENG-001', body: 'IN_PROGRESS → SUBMITTED' })
  })

  it('still answers 409 for an illegal move by an assigned engineer', async () => {
    const err = await rejection(transitionReport('RPT-1001', ASSIGNED, bob))
    expect(err.status).toBe(409)
  })

  it.each([
    ['approve', 'RPT-1004', APPROVED, carol],
    ['send back', 'RPT-1004', IN_PROGRESS, carol],
    ['archive', 'RPT-1005', ARCHIVED, bob],
    ['unassign', 'RPT-1003', UNASSIGNED, dave],
  ])('refuses to let an assigned engineer %s, with a 403', async (_verb, reportId, next, engineer) => {
    const err = await rejection(transitionReport(reportId, next, engineer))
    expect(err).toMatchObject({ status: 403, message: 'Only a Faculty Admin can perform this transition' })
  })

  it.each([
    ['an engineer not on the report', carol],
    ['the author', alice],
  ])('refuses %s with a 403', async (_case, who) => {
    const err = await rejection(transitionReport('RPT-1001', SUBMITTED, who))
    expect(err).toMatchObject({ status: 403, message: 'Only an assigned engineer can change this report' })
  })

  it('answers 404 for an unknown report', async () => {
    expect((await rejection(transitionReport('RPT-404', SUBMITTED, admin))).status).toBe(404)
  })
})

describe('assignEngineers', () => {
  it('assigns an UNASSIGNED report, moving it to ASSIGNED and approving matching requests', async () => {
    const report = await assignEngineers('RPT-1002', ['ENG-002'], frank)

    expect(report.status).toBe(ASSIGNED)
    expect(report.assignees).toEqual([
      {
        reportId: 'RPT-1002',
        assigneeId: 'ENG-002',
        accessLevel: 'CONTRIBUTOR',
        assignedBy: 'FA-001',
        assignedAt: expect.any(String),
        employee: carol,
      },
    ])
    expect(report.pendingAssignmentRequests).toEqual([])
    expect(areq('AREQ-1').status).toBe('APPROVED')
    expect(thread('RPT-1002').slice(-2).map((a) => [a.kind, a.body])).toEqual([
      ['assignment', 'Assigned Carol Singh'],
      ['status', 'UNASSIGNED → ASSIGNED'],
    ])
    expect(persisted().assignments).toContainEqual(expect.objectContaining({ reportId: 'RPT-1002', assigneeId: 'ENG-002' }))
  })

  it('leaves requests from engineers it did not assign pending', async () => {
    await assignEngineers('RPT-1002', ['ENG-001'], frank)
    expect(areq('AREQ-1').status).toBe('PENDING')
  })

  it('lets a faculty admin take a case themselves', async () => {
    const report = await assignEngineers('RPT-1002', ['FA-001'], frank)
    expect(report.assignees.map((a) => a.employee.name)).toEqual(['Frank Delgado'])
    expect(report.status).toBe(ASSIGNED)
  })

  it('collapses duplicate ids and names everyone assigned in one entry', async () => {
    await assignEngineers('RPT-1002', ['ENG-001', 'ENG-001', 'ENG-002'], frank)
    expect(assigneesOf('RPT-1002')).toEqual(['ENG-001', 'ENG-002'])
    expect(thread('RPT-1002').at(-2).body).toBe('Assigned Bob Martinez, Carol Singh')
  })

  it('moves an ASSIGNED report back to UNASSIGNED when the last engineer is taken off', async () => {
    const report = await assignEngineers('RPT-1003', [], grace)

    expect(report).toMatchObject({ status: UNASSIGNED, assignees: [] })
    expect(thread('RPT-1003').slice(-2).map((a) => a.body)).toEqual([
      'Unassigned Dave Kowalski',
      'ASSIGNED → UNASSIGNED',
    ])
  })

  it('reassigns work in progress without changing its status', async () => {
    const before = row('RPT-1001').updatedAt
    const report = await assignEngineers('RPT-1001', ['ENG-002'], frank)

    expect(report.status).toBe(IN_PROGRESS)
    expect(assigneesOf('RPT-1001')).toEqual(['ENG-002'])
    expect(thread('RPT-1001').slice(-2).map((a) => a.body)).toEqual([
      'Unassigned Bob Martinez',
      'Assigned Carol Singh',
    ])
    expect(row('RPT-1001').updatedAt > before).toBe(true)
  })

  it('keeps work in progress IN_PROGRESS even with nobody left on it', async () => {
    await expect(assignEngineers('RPT-1001', [], frank)).resolves.toMatchObject({ status: IN_PROGRESS, assignees: [] })
  })

  it('records nothing when the set does not change', async () => {
    const entries = thread('RPT-1001').length
    await assignEngineers('RPT-1001', ['ENG-001'], frank)
    expect(thread('RPT-1001')).toHaveLength(entries)
  })

  it('refuses anyone but a faculty admin with a 403', async () => {
    const err = await rejection(assignEngineers('RPT-1002', ['ENG-001'], bob))
    expect(err).toMatchObject({ status: 403, message: 'Only a Faculty Admin can assign engineers' })
  })

  it('answers 404 for an unknown report', async () => {
    expect((await rejection(assignEngineers('RPT-404', ['ENG-001'], frank))).status).toBe(404)
  })

  it('refuses an archived report with a 409', async () => {
    const err = await rejection(assignEngineers('RPT-1006', ['ENG-003'], grace))
    expect(err).toMatchObject({ status: 409, message: 'Archived reports cannot be assigned' })
  })

  it.each(['EMP-001', 'FA-002', 'NOBODY'])('refuses %s, who is neither the admin nor an engineer, with a 400', async (id) => {
    const err = await rejection(assignEngineers('RPT-1002', ['ENG-001', id], frank))
    expect(err).toMatchObject({ status: 400, message: `${id} is not you or an engineer` })
    expect(assigneesOf('RPT-1002')).toEqual([])
  })
})

describe('approveAssignmentRequest', () => {
  it('adds the engineer to whoever is already on the report', async () => {
    getDb().assignmentRequests.push({ requestId: 'AREQ-X', reportId: 'RPT-1001', engineerId: 'ENG-002', status: 'PENDING' })

    const report = await approveAssignmentRequest('AREQ-X', frank)

    expect(report.assignees.map((a) => a.assigneeId)).toEqual(['ENG-001', 'ENG-002'])
    expect(areq('AREQ-X').status).toBe('APPROVED')
  })

  it('assigns an UNASSIGNED report to the requesting engineer', async () => {
    const report = await approveAssignmentRequest('AREQ-1', frank)
    expect(report).toMatchObject({ status: ASSIGNED, pendingAssignmentRequests: [] })
    expect(areq('AREQ-1').status).toBe('APPROVED')
  })

  it('answers 404 for an unknown request', async () => {
    const err = await rejection(approveAssignmentRequest('AREQ-404', frank))
    expect(err).toMatchObject({ status: 404, message: 'Request not found' })
  })

  it('refuses a request that was already decided, with a 409', async () => {
    await declineAssignmentRequest('AREQ-1', frank)
    const err = await rejection(approveAssignmentRequest('AREQ-1', frank))
    expect(err).toMatchObject({ status: 409, message: 'Request already resolved' })
  })

  it('refuses anyone but a faculty admin with a 403', async () => {
    const err = await rejection(approveAssignmentRequest('AREQ-1', bob))
    expect(err.status).toBe(403)
    expect(areq('AREQ-1').status).toBe('PENDING')
  })
})

describe('declineAssignmentRequest', () => {
  it('declines the request, noting it in the thread and leaving the report alone', async () => {
    const request = await declineAssignmentRequest('AREQ-1', frank)

    expect(request).toMatchObject({ requestId: 'AREQ-1', status: 'DECLINED' })
    expect(lastEntry('RPT-1002')).toMatchObject({
      kind: 'request',
      authorId: 'FA-001',
      body: 'Declined assignment request from Carol Singh',
    })
    expect(row('RPT-1002').status).toBe(UNASSIGNED)
    expect((await listPendingRequests({ viewer: frank })).assignmentRequests).toEqual([])
  })

  it('refuses anyone but a faculty admin with a 403', async () => {
    const err = await rejection(declineAssignmentRequest('AREQ-1', bob))
    expect(err).toMatchObject({ status: 403, message: 'Only a Faculty Admin can decline requests' })
  })

  it('answers 404 for an unknown request', async () => {
    expect((await rejection(declineAssignmentRequest('AREQ-404', frank))).status).toBe(404)
  })

  // As the backend's requirePending does.
  it('refuses a request that was already decided, with a 409', async () => {
    await approveAssignmentRequest('AREQ-1', frank)
    const err = await rejection(declineAssignmentRequest('AREQ-1', frank))
    expect(err.status).toBe(409)
    expect(areq('AREQ-1').status).toBe('APPROVED')
  })
})

describe('approveCloseRequest', () => {
  it.each([
    [ASSIGNED, ['ASSIGNED → IN_PROGRESS', 'IN_PROGRESS → SUBMITTED', 'SUBMITTED → APPROVED', 'APPROVED → ARCHIVED']],
    [IN_PROGRESS, ['IN_PROGRESS → SUBMITTED', 'SUBMITTED → APPROVED', 'APPROVED → ARCHIVED']],
    [SUBMITTED, ['SUBMITTED → APPROVED', 'APPROVED → ARCHIVED']],
    [APPROVED, ['APPROVED → ARCHIVED']],
    [ARCHIVED, []],
  ])('walks a %s report to ARCHIVED through the legal moves', async (from, steps) => {
    row('RPT-1004').status = from
    const entries = thread('RPT-1004').length

    const report = await approveCloseRequest('CREQ-1', frank)

    expect(report).toMatchObject({ status: ARCHIVED, pendingCloseRequest: null })
    expect(creq('CREQ-1').status).toBe('APPROVED')
    expect(thread('RPT-1004').slice(entries).map((a) => a.body)).toEqual([...steps, 'Confirmed close request'])
    expect(persisted().reports.find((r) => r.reportId === 'RPT-1004').status).toBe(ARCHIVED)
  })

  it('refuses an UNASSIGNED report with a 409 and leaves the request pending', async () => {
    const request = await requestClose('RPT-1002', alice)
    const err = await rejection(approveCloseRequest(request.requestId, frank))
    expect(err).toMatchObject({ status: 409, message: 'Assign an engineer before closing, or decline the request' })
    expect(creq(request.requestId).status).toBe('PENDING')
  })

  it('refuses anyone but a faculty admin with a 403', async () => {
    const err = await rejection(approveCloseRequest('CREQ-1', alice))
    expect(err).toMatchObject({ status: 403, message: 'Only a Faculty Admin can confirm a close' })
  })

  it('answers 404 for an unknown request, or one whose report is gone', async () => {
    expect(await rejection(approveCloseRequest('CREQ-404', frank))).toMatchObject({
      status: 404,
      message: 'Request not found',
    })
    getDb().reports = getDb().reports.filter((r) => r.reportId !== 'RPT-1004')
    expect(await rejection(approveCloseRequest('CREQ-1', frank))).toMatchObject({
      status: 404,
      message: 'Report RPT-1004 not found',
    })
  })

  it('refuses a request that was already decided, with a 409', async () => {
    await declineCloseRequest('CREQ-1', frank)
    const err = await rejection(approveCloseRequest('CREQ-1', frank))
    expect(err).toMatchObject({ status: 409, message: 'Request already resolved' })
  })
})

describe('declineCloseRequest', () => {
  it('declines the request, noting it in the thread and leaving the report open', async () => {
    const request = await declineCloseRequest('CREQ-1', frank)

    expect(request).toMatchObject({ requestId: 'CREQ-1', status: 'DECLINED' })
    expect(lastEntry('RPT-1004')).toMatchObject({ kind: 'request', authorId: 'FA-001', body: 'Declined close request' })
    const report = await getReport('RPT-1004')
    expect(report).toMatchObject({ status: SUBMITTED, pendingCloseRequest: null })
  })

  it('refuses anyone but a faculty admin with a 403', async () => {
    const err = await rejection(declineCloseRequest('CREQ-1', alice))
    expect(err).toMatchObject({ status: 403, message: 'Only a Faculty Admin can decline requests' })
  })

  it('answers 404 for an unknown request', async () => {
    expect((await rejection(declineCloseRequest('CREQ-404', frank))).status).toBe(404)
  })

  it('refuses a request that was already decided, with a 409', async () => {
    await approveCloseRequest('CREQ-1', frank)
    const err = await rejection(declineCloseRequest('CREQ-1', frank))
    expect(err.status).toBe(409)
    expect(creq('CREQ-1').status).toBe('APPROVED')
  })
})
