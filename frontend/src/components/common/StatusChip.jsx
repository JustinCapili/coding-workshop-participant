import Chip from '@mui/material/Chip'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import PersonPinIcon from '@mui/icons-material/PersonPin'
import BuildIcon from '@mui/icons-material/Build'
import RateReviewIcon from '@mui/icons-material/RateReview'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import { ReportStatus, STATUS_COLORS, STATUS_LABELS } from '../../domain/reportStatus'

const ICONS = {
  [ReportStatus.UNASSIGNED]: RadioButtonUncheckedIcon,
  [ReportStatus.ASSIGNED]: PersonPinIcon,
  [ReportStatus.IN_PROGRESS]: BuildIcon,
  [ReportStatus.SUBMITTED]: RateReviewIcon,
  [ReportStatus.APPROVED]: CheckCircleIcon,
  [ReportStatus.ARCHIVED]: Inventory2Icon,
}

/** ReportStatus as a chip: icon + label, so state never depends on colour alone. */
export default function StatusChip({ status, size = 'small', ...props }) {
  const Icon = ICONS[status] ?? RadioButtonUncheckedIcon
  return (
    <Chip
      size={size}
      icon={<Icon fontSize="small" />}
      label={STATUS_LABELS[status] ?? status}
      color={STATUS_COLORS[status] ?? 'default'}
      variant={status === ReportStatus.ARCHIVED ? 'outlined' : 'filled'}
      {...props}
    />
  )
}
