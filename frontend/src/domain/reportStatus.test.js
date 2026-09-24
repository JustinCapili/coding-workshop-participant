import {
  ACTIVE_ASSIGNMENT_STATUSES,
  ALLOWED_NEXT,
  COMPLETED_STATUSES,
  OPEN_STATUSES,
  REPORT_STATUSES,
  ReportStatus,
  STATUS_COLORS,
  STATUS_LABELS,
  canMoveTo,
  isOpen,
} from './reportStatus'

const {
  UNASSIGNED, ASSIGNED, IN_PROGRESS, SUBMITTED, APPROVED, ARCHIVED,
} = ReportStatus

// Every legal move, spelled out so a change to ALLOWED_NEXT has to be made here on purpose.
const LEGAL_MOVES = [
  [UNASSIGNED, ASSIGNED],
  [ASSIGNED, IN_PROGRESS],
  [ASSIGNED, UNASSIGNED],
  [IN_PROGRESS, SUBMITTED],
  [SUBMITTED, APPROVED],
  [SUBMITTED, IN_PROGRESS],
  [APPROVED, ARCHIVED],
]

describe('ReportStatus', () => {
  it('lists the six statuses in lifecycle order', () => {
    expect(REPORT_STATUSES).toEqual([
      'UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'ARCHIVED',
    ])
  })

  it('is frozen so pages cannot rewrite the enum', () => {
    expect(Object.isFrozen(ReportStatus)).toBe(true)
    expect(Object.isFrozen(ALLOWED_NEXT)).toBe(true)
  })
})

describe('canMoveTo', () => {
  const allPairs = REPORT_STATUSES.flatMap((from) => REPORT_STATUSES.map((to) => [from, to]))

  it.each(allPairs)('from %s to %s follows the ALLOWED_NEXT table', (from, to) => {
    const legal = LEGAL_MOVES.some(([f, t]) => f === from && t === to)
    expect(canMoveTo(from, to)).toBe(legal)
  })

  it('has an entry for every status, and ARCHIVED is terminal', () => {
    expect(Object.keys(ALLOWED_NEXT).sort()).toEqual([...REPORT_STATUSES].sort())
    expect(ALLOWED_NEXT[ARCHIVED]).toEqual([])
  })

  it('is false for an unknown starting status', () => {
    expect(canMoveTo('LOST', ASSIGNED)).toBe(false)
    expect(canMoveTo(undefined, ASSIGNED)).toBe(false)
  })
})

describe('isOpen and the status sets', () => {
  it.each(REPORT_STATUSES)('isOpen(%s) is true for everything except ARCHIVED', (status) => {
    expect(isOpen(status)).toBe(status !== ARCHIVED)
  })

  it('OPEN_STATUSES is every status but ARCHIVED', () => {
    expect(OPEN_STATUSES).toEqual([UNASSIGNED, ASSIGNED, IN_PROGRESS, SUBMITTED, APPROVED])
  })

  it('COMPLETED_STATUSES is APPROVED and ARCHIVED', () => {
    expect(COMPLETED_STATUSES).toEqual([APPROVED, ARCHIVED])
  })

  it('an engineer is busy on ASSIGNED and IN_PROGRESS reports', () => {
    expect(ACTIVE_ASSIGNMENT_STATUSES).toEqual([ASSIGNED, IN_PROGRESS])
  })
})

describe('labels and colors', () => {
  it('labels every status for people', () => {
    expect(STATUS_LABELS).toEqual({
      UNASSIGNED: 'Unassigned',
      ASSIGNED: 'Assigned',
      IN_PROGRESS: 'In progress',
      SUBMITTED: 'Submitted',
      APPROVED: 'Approved',
      ARCHIVED: 'Archived',
    })
  })

  it('gives every status an MUI palette key', () => {
    expect(STATUS_COLORS).toEqual({
      UNASSIGNED: 'default',
      ASSIGNED: 'info',
      IN_PROGRESS: 'primary',
      SUBMITTED: 'warning',
      APPROVED: 'success',
      ARCHIVED: 'default',
    })
  })
})
