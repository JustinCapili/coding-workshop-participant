import { Role, Scope } from '../../domain/roles'
import {
  assignmentRequest,
  closeRequest,
  comment,
  engineer,
  nameFromEmail,
  person,
  report,
} from './normalize'

describe('nameFromEmail', () => {
  it('title-cases the local part, splitting on dots, underscores and dashes', () => {
    expect(nameFromEmail('jane.doe@acme.com')).toBe('Jane Doe')
    expect(nameFromEmail('mary_ann-smith@acme.com')).toBe('Mary Ann Smith')
    expect(nameFromEmail('bob@acme.com')).toBe('Bob')
  })

  it('names a missing email "Former employee"', () => {
    expect(nameFromEmail(undefined)).toBe('Former employee')
    expect(nameFromEmail('')).toBe('Former employee')
  })
})

describe('person and engineer', () => {
  it('adds a derived name and TEAM scope, keeping the other fields', () => {
    expect(person({ employeeId: 'E1', email: 'jane.doe@acme.com', role: Role.EMPLOYEE, facultyAdminId: 'F1' }))
      .toEqual({
        employeeId: 'E1',
        email: 'jane.doe@acme.com',
        role: Role.EMPLOYEE,
        facultyAdminId: 'F1',
        name: 'Jane Doe',
        scope: Scope.TEAM,
      })
  })

  it('is null for no summary, and gives a record without email an empty one', () => {
    expect(person(null)).toBeNull()
    expect(person({ employeeId: 'E9' })).toEqual({
      employeeId: 'E9',
      email: '',
      name: 'Former employee',
      scope: Scope.TEAM,
    })
  })

  it('engineer marks an EngineerResponse with the ENGINEER role', () => {
    expect(engineer({ employeeId: 'ENG-1', email: 'bob@acme.com', facultyAdminId: 'FA-1' })).toEqual({
      employeeId: 'ENG-1',
      email: 'bob@acme.com',
      facultyAdminId: 'FA-1',
      role: Role.ENGINEER,
      name: 'Bob',
      scope: Scope.TEAM,
    })
  })
})

describe('report', () => {
  it('is null for no response', () => {
    expect(report(null)).toBeNull()
  })

  it('normalizes the author, assignees, pending requests and activity', () => {
    const res = {
      reportId: 'R1',
      title: 'Leak',
      author: { employeeId: 'E1', email: 'alice@acme.com', role: Role.EMPLOYEE },
      assignees: [{ assigneeId: 'ENG-1', employee: { employeeId: 'ENG-1', email: 'bob@acme.com' } }],
      pendingAssignmentRequests: [
        { requestId: 'A1', engineer: { employeeId: 'ENG-2', email: 'carol@acme.com' } },
      ],
      pendingCloseRequest: { requestId: 'C1', requester: { employeeId: 'E1', email: 'alice@acme.com' } },
      activity: [
        { activityId: 'X1', kind: 'COMMENT', body: 'hi', author: { employeeId: 'E1', email: 'alice@acme.com' } },
      ],
    }
    const out = report(res)

    expect(out.title).toBe('Leak')
    expect(out.author).toMatchObject({ name: 'Alice', scope: Scope.TEAM })
    expect(out.assignees[0]).toMatchObject({ assigneeId: 'ENG-1', employee: { name: 'Bob' } })
    expect(out.pendingAssignmentRequests[0]).toMatchObject({
      requestId: 'A1',
      engineer: { name: 'Carol' },
      report: null,
    })
    expect(out.pendingCloseRequest).toMatchObject({
      requestId: 'C1',
      requester: { name: 'Alice' },
      report: null,
    })
    expect(out.activity[0]).toMatchObject({ kind: 'comment', body: 'hi', author: { name: 'Alice' } })
  })

  it('falls back to id-only people and empty lists when the backend omits them', () => {
    const out = report({
      reportId: 'R2',
      authorId: 'E7',
      assignees: [{ assigneeId: 'ENG-9' }],
      activity: [{ activityId: 'X2', kind: 'STATUS', authorId: 'FA-1' }],
    })

    expect(out.author).toEqual({ employeeId: 'E7', email: '', name: 'Former employee', scope: Scope.TEAM })
    expect(out.assignees[0].employee).toMatchObject({ employeeId: 'ENG-9', name: 'Former employee' })
    expect(out.pendingAssignmentRequests).toEqual([])
    expect(out.pendingCloseRequest).toBeNull()
    expect(out.activity[0]).toMatchObject({
      kind: 'status',
      body: '',
      author: { employeeId: 'FA-1', name: 'Former employee' },
    })

    expect(report({ reportId: 'R3', authorId: 'E1' })).toMatchObject({ assignees: [], activity: [] })
  })
})

describe('request and comment shapes', () => {
  it('assignmentRequest normalizes its engineer and embedded report', () => {
    const out = assignmentRequest({
      requestId: 'A1',
      engineerId: 'ENG-1',
      report: { reportId: 'R1', authorId: 'E1' },
    })
    expect(out.engineer).toMatchObject({ employeeId: 'ENG-1', name: 'Former employee' })
    expect(out.report).toMatchObject({ reportId: 'R1', author: { employeeId: 'E1' }, assignees: [] })
  })

  it('closeRequest normalizes its requester and embedded report', () => {
    const out = closeRequest({
      requestId: 'C1',
      requestedBy: 'E1',
      report: { reportId: 'R1', authorId: 'E1' },
    })
    expect(out.requester).toMatchObject({ employeeId: 'E1', name: 'Former employee' })
    expect(out.report).toMatchObject({ reportId: 'R1' })
  })

  it('comment lower-cases the kind and normalizes the author', () => {
    expect(comment({ activityId: 'X', kind: 'COMMENT', body: 'ok', author: { employeeId: 'E1', email: 'a.b@acme.com' } }))
      .toMatchObject({ kind: 'comment', body: 'ok', author: { name: 'A B' } })
    expect(comment({ activityId: 'Y', authorId: 'E1' }).kind).toBeUndefined()
  })
})
