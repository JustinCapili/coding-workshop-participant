import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { oldestFirst } from '../../domain/reportOrder'
import { OPEN_STATUSES } from '../../domain/reportStatus'
import { useAsync } from '../../hooks/useAsync'
import * as reportsService from '../../services/reportsService'
import ReportFilters from './ReportFilters'
import ReportGrid from './ReportGrid'

/**
 * "Current incidents" block: location + status filters over the viewer's open reports.
 * Pages supply `renderActions(report, reload)` for role-specific buttons on each card.
 * Exposes `reloadRef` so a parent can refresh after an action taken elsewhere (e.g. a dialog).
 * `pageSize` shows the cards a set at a time (see ReportGrid); changing a filter starts again from
 * the first set. Incidents are listed oldest filed first, so the longest-waiting come first.
 */
export default function IncidentBoard({ viewer, title = 'Current incidents', renderActions, showAuthor = false, onLoaded, pageSize }) {
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState('')

  const { data, loading, error, reload } = useAsync(
    () =>
      reportsService
        .listReports({ viewer, location, status: status || undefined, openOnly: true })
        .then((rows) => {
          const ordered = oldestFirst(rows)
          onLoaded?.(ordered)
          return ordered
        }),
    [viewer, location, status],
  )

  return (
    <Box component="section" aria-labelledby="incident-board-title">
      <Typography id="incident-board-title" variant="h5" component="h2" sx={{ mb: 1.5 }}>
        {title}
        {data && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {data.length} {data.length === 1 ? 'report' : 'reports'}
          </Typography>
        )}
      </Typography>
      <ReportFilters
        location={location}
        onLocationChange={setLocation}
        status={status}
        onStatusChange={setStatus}
        statuses={OPEN_STATUSES}
        onClear={() => {
          setLocation('')
          setStatus('')
        }}
      />
      <ReportGrid
        key={`${location}|${status}`}
        pageSize={pageSize}
        reports={data}
        loading={loading}
        error={error}
        onRetry={reload}
        showAuthor={showAuthor}
        renderActions={renderActions ? (report) => renderActions(report, reload) : undefined}
        emptyTitle="No open incidents match"
        emptyDescription={location || status ? 'Try clearing a filter.' : 'Nothing is waiting on you right now.'}
      />
    </Box>
  )
}
