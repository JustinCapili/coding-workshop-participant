import Chip from '@mui/material/Chip'
import { PRIORITIES, labelFor } from '../../domain/incidentOptions'

const COLORS = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'error',
}

export default function PriorityChip({ priority, ...props }) {
  if (!priority) return null
  return (
    <Chip
      size="small"
      variant="outlined"
      label={`${labelFor(PRIORITIES, priority)} priority`}
      color={COLORS[priority] ?? 'default'}
      {...props}
    />
  )
}
