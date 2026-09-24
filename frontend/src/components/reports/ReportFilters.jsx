import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import { REPORT_STATUSES, STATUS_LABELS } from '../../domain/reportStatus'

/**
 * One-row filter bar. Renders only the controls whose props are provided:
 *  - location / onLocationChange       substring filter
 *  - status / onStatusChange / statuses exact status
 *  - from,to / onFromChange,onToChange  date range (updatedAt)
 *  - engineerId / onEngineerChange / engineers  completing engineer
 */
export default function ReportFilters({
  location,
  onLocationChange,
  status,
  onStatusChange,
  statuses = REPORT_STATUSES,
  from,
  to,
  onFromChange,
  onToChange,
  engineerId,
  onEngineerChange,
  engineers = [],
  onClear,
}) {
  const hasValue = Boolean(location || status || from || to || engineerId)
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} useFlexGap flexWrap="wrap">
        {onLocationChange && (
          <TextField
            label="Location"
            placeholder="Room, floor or building"
            value={location ?? ''}
            onChange={(e) => onLocationChange(e.target.value)}
            sx={{ minWidth: { md: 240 }, flex: { md: 1 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
        {onStatusChange && (
          <TextField
            select
            label="Status"
            value={status ?? ''}
            onChange={(e) => onStatusChange(e.target.value)}
            sx={{ minWidth: { md: 180 }, width: { md: 'auto' } }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {statuses.map((s) => (
              <MenuItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </MenuItem>
            ))}
          </TextField>
        )}
        {onFromChange && (
          <TextField
            type="date"
            label="From"
            value={from ?? ''}
            onChange={(e) => onFromChange(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: { md: 170 } }}
          />
        )}
        {onToChange && (
          <TextField
            type="date"
            label="To"
            value={to ?? ''}
            onChange={(e) => onToChange(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: { md: 170 } }}
          />
        )}
        {onEngineerChange && (
          <TextField
            select
            label="Completed by"
            value={engineerId ?? ''}
            onChange={(e) => onEngineerChange(e.target.value)}
            sx={{ minWidth: { md: 200 }, width: { md: 'auto' } }}
          >
            <MenuItem value="">Any engineer</MenuItem>
            {engineers.map((e) => (
              <MenuItem key={e.employeeId} value={e.employeeId}>
                {e.name}
              </MenuItem>
            ))}
          </TextField>
        )}
        {onClear && (
          <Button onClick={onClear} disabled={!hasValue} sx={{ alignSelf: { xs: 'flex-end', md: 'center' } }}>
            Clear
          </Button>
        )}
      </Stack>
    </Paper>
  )
}
