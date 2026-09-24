/**
 * Mirror of backend `com.example.classes.ReportStatus`.
 *
 * The forward path is UNASSIGNED -> ASSIGNED -> IN_PROGRESS -> SUBMITTED -> APPROVED -> ARCHIVED.
 * Two moves go backwards (ASSIGNED -> UNASSIGNED when the last grant is revoked, and
 * SUBMITTED -> IN_PROGRESS when a reviewer wants more work). Keep `ALLOWED_NEXT` in sync with
 * `ReportStatus.allowedNext()` so the UI never offers a move the backend will reject.
 */
export const ReportStatus = Object.freeze({
  UNASSIGNED: 'UNASSIGNED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  ARCHIVED: 'ARCHIVED',
})

export const REPORT_STATUSES = Object.values(ReportStatus)

export const ALLOWED_NEXT = Object.freeze({
  [ReportStatus.UNASSIGNED]: [ReportStatus.ASSIGNED],
  [ReportStatus.ASSIGNED]: [ReportStatus.IN_PROGRESS, ReportStatus.UNASSIGNED],
  [ReportStatus.IN_PROGRESS]: [ReportStatus.SUBMITTED],
  [ReportStatus.SUBMITTED]: [ReportStatus.APPROVED, ReportStatus.IN_PROGRESS],
  [ReportStatus.APPROVED]: [ReportStatus.ARCHIVED],
  [ReportStatus.ARCHIVED]: [],
})

export function canMoveTo(from, to) {
  return (ALLOWED_NEXT[from] ?? []).includes(to)
}

/** Human labels for the enum values. */
export const STATUS_LABELS = Object.freeze({
  [ReportStatus.UNASSIGNED]: 'Unassigned',
  [ReportStatus.ASSIGNED]: 'Assigned',
  [ReportStatus.IN_PROGRESS]: 'In progress',
  [ReportStatus.SUBMITTED]: 'Submitted',
  [ReportStatus.APPROVED]: 'Approved',
  [ReportStatus.ARCHIVED]: 'Archived',
})

/** MUI palette key used by the status chip. Always paired with a text label, never color alone. */
export const STATUS_COLORS = Object.freeze({
  [ReportStatus.UNASSIGNED]: 'default',
  [ReportStatus.ASSIGNED]: 'info',
  [ReportStatus.IN_PROGRESS]: 'primary',
  [ReportStatus.SUBMITTED]: 'warning',
  [ReportStatus.APPROVED]: 'success',
  [ReportStatus.ARCHIVED]: 'default',
})

/** Statuses that count as "open" / current work. */
export const OPEN_STATUSES = REPORT_STATUSES.filter((s) => s !== ReportStatus.ARCHIVED)

/** Statuses that count as "completed" for the Previous Reports reference view. */
export const COMPLETED_STATUSES = [ReportStatus.APPROVED, ReportStatus.ARCHIVED]

export function isOpen(status) {
  return status !== ReportStatus.ARCHIVED
}

/** An engineer is "busy" when they hold a grant on a report in one of these states. */
export const ACTIVE_ASSIGNMENT_STATUSES = [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS]
