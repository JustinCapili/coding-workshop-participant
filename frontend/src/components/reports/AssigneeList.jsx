import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { initials } from '../../utils/format'

/** Who holds a grant on the report (from ReportAssignment). */
export default function AssigneeList({ assignees = [] }) {
  if (!assignees.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nobody assigned yet
      </Typography>
    )
  }
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {assignees.map((a) => (
        <Chip
          key={a.assigneeId}
          avatar={<Avatar>{initials(a.employee?.name)}</Avatar>}
          label={a.employee?.name ?? a.assigneeId}
          title={`${a.accessLevel} · assigned by ${a.assignedBy ?? 'author'}`}
          variant="outlined"
        />
      ))}
    </Stack>
  )
}
