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
} from './reportsApi'

const BASE = 'http://api.test/api/springboot-service'

const respond = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: '',
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
})

/** "METHOD /path?query" and the parsed body of the only fetch call. */
function sent() {
  expect(global.fetch).toHaveBeenCalledTimes(1)
  const [url, init] = global.fetch.mock.calls[0]
  return [`${init.method} ${url.replace(BASE, '')}`, init.body && JSON.parse(init.body)]
}

const backendReport = {
  reportId: 'R 1',
  title: 'Leak',
  status: 'ASSIGNED',
  authorId: 'EMP-1',
  author: { employeeId: 'EMP-1', email: 'alice@acme.com', role: 'EMPLOYEE' },
  assignees: [{ assigneeId: 'ENG-1', employee: { employeeId: 'ENG-1', email: 'bob@acme.com' } }],
  activity: [{ activityId: 'A1', kind: 'COMMENT', body: 'hi', authorId: 'EMP-1' }],
}

/** What normalize.report makes of backendReport, in the parts these tests look at. */
const normalizedReport = expect.objectContaining({
  reportId: 'R 1',
  author: expect.objectContaining({ name: 'Alice', scope: 'TEAM' }),
  assignees: [expect.objectContaining({ employee: expect.objectContaining({ name: 'Bob' }) })],
  pendingAssignmentRequests: [],
  pendingCloseRequest: null,
  activity: [expect.objectContaining({ kind: 'comment' })],
})

const realFetch = global.fetch

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue(respond(200, backendReport))
})

afterEach(() => {
  global.fetch = realFetch
})

describe('reads', () => {
  it('listReports sends only the filters that are set, with the location trimmed', async () => {
    global.fetch.mockResolvedValue(respond(200, [backendReport]))

    const list = await listReports({
      viewer: { employeeId: 'ignored' },
      status: 'ASSIGNED',
      location: '  Building A ',
      from: '2026-01-01',
      to: '2026-01-31',
      completedBy: 'ENG-1',
      completedOnly: true,
    })

    expect(sent()[0]).toBe(
      'GET /reports?status=ASSIGNED&location=Building+A&from=2026-01-01&to=2026-01-31&completedBy=ENG-1&completedOnly=true',
    )
    expect(list).toEqual([normalizedReport])
  })

  it('listReports with no filters asks for every visible report', async () => {
    global.fetch.mockResolvedValue(respond(200, []))
    await expect(listReports()).resolves.toEqual([])
    expect(sent()[0]).toBe('GET /reports')
  })

  it('listReports passes openOnly through', async () => {
    global.fetch.mockResolvedValue(respond(200, []))
    await listReports({ openOnly: true })
    expect(sent()[0]).toBe('GET /reports?openOnly=true')
  })

  it('getReport fetches one report by encoded id and normalizes it', async () => {
    await expect(getReport('R 1', { viewer: {} })).resolves.toEqual(normalizedReport)
    expect(sent()).toEqual(['GET /reports/R%201', undefined])
  })

  it('listPendingRequests asks for PENDING requests and normalizes both queues', async () => {
    global.fetch.mockResolvedValue(respond(200, {
      assignmentRequests: [{ requestId: 'AR1', engineerId: 'ENG-1', report: backendReport }],
      closeRequests: [{ requestId: 'CR1', requester: { employeeId: 'EMP-1', email: 'alice@acme.com' } }],
    }))

    const pending = await listPendingRequests({ viewer: {} })

    expect(sent()[0]).toBe('GET /reports/requests?status=PENDING')
    expect(pending.assignmentRequests).toEqual([
      expect.objectContaining({
        requestId: 'AR1',
        engineer: expect.objectContaining({ employeeId: 'ENG-1', name: 'Former employee' }),
        report: normalizedReport,
      }),
    ])
    expect(pending.closeRequests).toEqual([
      expect.objectContaining({ requestId: 'CR1', requester: expect.objectContaining({ name: 'Alice' }), report: null }),
    ])
  })

  it('listPendingRequests treats missing queues as empty', async () => {
    global.fetch.mockResolvedValue(respond(200, {}))
    await expect(listPendingRequests()).resolves.toEqual({ assignmentRequests: [], closeRequests: [] })
  })

  it('getDashboardStats returns the stats as the backend sends them', async () => {
    const stats = { incidentsToday: 1, openCases: 2, unassigned: 0, availableEngineers: 3, totalEngineers: 4, pendingApprovals: 5 }
    global.fetch.mockResolvedValue(respond(200, stats))
    await expect(getDashboardStats({ viewer: {} })).resolves.toEqual(stats)
    expect(sent()[0]).toBe('GET /reports/stats')
  })
})

describe('writes', () => {
  it('createReport posts the fields and leaves out an empty type and priority', async () => {
    await expect(
      createReport({ title: 'Leak', body: 'Drip', location: 'A1', incidentType: '', priority: '' }),
    ).resolves.toEqual(normalizedReport)
    expect(sent()).toEqual(['POST /reports', { title: 'Leak', body: 'Drip', location: 'A1' }])
  })

  it('createReport sends a chosen type and priority', async () => {
    await createReport({ title: 'Leak', body: '', location: 'A1', incidentType: 'IT', priority: 'HIGH' })
    expect(sent()[1]).toEqual({ title: 'Leak', body: '', location: 'A1', incidentType: 'IT', priority: 'HIGH' })
  })

  it('addComment posts the body and normalizes the entry', async () => {
    global.fetch.mockResolvedValue(respond(201, { activityId: 'A2', kind: 'COMMENT', body: 'On it', authorId: 'ENG-1' }))
    await expect(addComment('R 1', 'On it', { employeeId: 'ignored' })).resolves.toMatchObject({
      kind: 'comment',
      body: 'On it',
      author: { employeeId: 'ENG-1' },
    })
    expect(sent()).toEqual(['POST /reports/R%201/comments', { body: 'On it' }])
  })

  it('requestClose posts without a body and normalizes the close request', async () => {
    global.fetch.mockResolvedValue(respond(201, { requestId: 'CR1', requestedBy: 'EMP-1', status: 'PENDING' }))
    await expect(requestClose('R 1', {})).resolves.toMatchObject({
      requestId: 'CR1',
      requester: { employeeId: 'EMP-1' },
      report: null,
    })
    expect(sent()).toEqual(['POST /reports/R%201/close-requests', undefined])
  })

  it('requestAssignment posts without a body and normalizes the assignment request', async () => {
    global.fetch.mockResolvedValue(respond(201, { requestId: 'AR1', engineerId: 'ENG-1', status: 'PENDING' }))
    await expect(requestAssignment('R 1', {})).resolves.toMatchObject({
      requestId: 'AR1',
      engineer: { employeeId: 'ENG-1' },
    })
    expect(sent()).toEqual(['POST /reports/R%201/assignment-requests', undefined])
  })

  it('transitionReport patches the status', async () => {
    await expect(transitionReport('R 1', 'IN_PROGRESS', {})).resolves.toEqual(normalizedReport)
    expect(sent()).toEqual(['PATCH /reports/R%201/status', { status: 'IN_PROGRESS' }])
  })

  it('assignEngineers puts the whole assignee list', async () => {
    await expect(assignEngineers('R 1', ['ENG-1', 'ENG-2'], {})).resolves.toEqual(normalizedReport)
    expect(sent()).toEqual(['PUT /reports/R%201/assignees', { engineerIds: ['ENG-1', 'ENG-2'] }])
  })
})

describe('approval decisions', () => {
  it('approveAssignmentRequest returns the updated report', async () => {
    await expect(approveAssignmentRequest('AR 1', {})).resolves.toEqual(normalizedReport)
    expect(sent()).toEqual(['POST /reports/assignment-requests/AR%201/approve', undefined])
  })

  it('declineAssignmentRequest returns the declined request', async () => {
    global.fetch.mockResolvedValue(respond(200, { requestId: 'AR1', engineerId: 'ENG-1', status: 'DECLINED' }))
    await expect(declineAssignmentRequest('AR1', {})).resolves.toMatchObject({
      status: 'DECLINED',
      engineer: { employeeId: 'ENG-1' },
    })
    expect(sent()[0]).toBe('POST /reports/assignment-requests/AR1/decline')
  })

  it('approveCloseRequest returns the archived report', async () => {
    await expect(approveCloseRequest('CR1', {})).resolves.toEqual(normalizedReport)
    expect(sent()[0]).toBe('POST /reports/close-requests/CR1/approve')
  })

  it('declineCloseRequest returns the declined request', async () => {
    global.fetch.mockResolvedValue(respond(200, { requestId: 'CR1', requestedBy: 'EMP-1', status: 'DECLINED' }))
    await expect(declineCloseRequest('CR1', {})).resolves.toMatchObject({
      status: 'DECLINED',
      requester: { employeeId: 'EMP-1' },
    })
    expect(sent()[0]).toBe('POST /reports/close-requests/CR1/decline')
  })
})
