import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SendIcon from '@mui/icons-material/Send'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import UndoIcon from '@mui/icons-material/Undo'
import ArchiveIcon from '@mui/icons-material/Archive'
import { ReportStatus, canMoveTo } from '../../domain/reportStatus'
import { isFacultyAdmin } from '../../domain/roles'

/**
 * Lifecycle buttons the current user is allowed to press, derived from ReportStatus.allowedNext
 * plus role: assignees move work forward, faculty admins review/archive.
 */
const ACTIONS = [
  { to: ReportStatus.IN_PROGRESS, from: ReportStatus.ASSIGNED, label: 'Start work', icon: PlayArrowIcon, who: 'assignee' },
  { to: ReportStatus.SUBMITTED, from: ReportStatus.IN_PROGRESS, label: 'Submit for review', icon: SendIcon, who: 'assignee' },
  { to: ReportStatus.APPROVED, from: ReportStatus.SUBMITTED, label: 'Approve', icon: ThumbUpIcon, who: 'admin', color: 'success' },
  { to: ReportStatus.IN_PROGRESS, from: ReportStatus.SUBMITTED, label: 'Send back', icon: UndoIcon, who: 'admin', color: 'warning' },
  { to: ReportStatus.ARCHIVED, from: ReportStatus.APPROVED, label: 'Archive', icon: ArchiveIcon, who: 'admin' },
]

export default function ReportStatusActions({ report, user, onTransition, busy = false }) {
  const isAssignee = report.assignees?.some((a) => a.assigneeId === user.employeeId)
  const admin = isFacultyAdmin(user)

  const available = ACTIONS.filter(
    (a) =>
      a.from === report.status &&
      canMoveTo(report.status, a.to) &&
      (a.who === 'admin' ? admin : isAssignee || admin),
  )
  if (!available.length) return null

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {available.map(({ to, label, icon: Icon, color = 'primary' }) => (
        <Button
          key={to + label}
          variant="contained"
          color={color}
          startIcon={<Icon />}
          disabled={busy}
          onClick={() => onTransition(to)}
        >
          {label}
        </Button>
      ))}
    </Stack>
  )
}
