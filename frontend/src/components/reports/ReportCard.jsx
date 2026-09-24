import { Link as RouterLink } from 'react-router-dom'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import PlaceIcon from '@mui/icons-material/Place'
import { INCIDENT_TYPES, labelFor } from '../../domain/incidentOptions'
import { formatRelative, initials } from '../../utils/format'
import PriorityChip from '../common/PriorityChip'
import StatusChip from '../common/StatusChip'

/**
 * Summary card for a report. `actions` (optional) renders in a footer outside the link area so
 * buttons do not trigger navigation.
 */
export default function ReportCard({ report, actions, showAuthor = false }) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea component={RouterLink} to={`/reports/${report.reportId}`} sx={{ flexGrow: 1, alignItems: 'stretch' }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, height: '100%' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <StatusChip status={report.status} />
            <PriorityChip priority={report.priority} />
          </Stack>
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {report.title}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary">
            <PlaceIcon fontSize="inherit" />
            <Typography variant="body2" noWrap>
              {report.location}
            </Typography>
          </Stack>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {report.reportId}
              {report.incidentType && ` · ${labelFor(INCIDENT_TYPES, report.incidentType)}`}
              {showAuthor && report.author ? ` · ${report.author.name}` : ''}
              {' · updated '}
              {formatRelative(report.updatedAt)}
            </Typography>
            {report.assignees?.length > 0 && (
              <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 26, height: 26, fontSize: 11 } }}>
                {report.assignees.map((a) => (
                  <Tooltip key={a.assigneeId} title={a.employee.name}>
                    <Avatar>{initials(a.employee.name)}</Avatar>
                  </Tooltip>
                ))}
              </AvatarGroup>
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
      {actions && <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>{actions}</CardActions>}
    </Card>
  )
}
