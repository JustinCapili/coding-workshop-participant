import { useState } from 'react'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import EmptyState from '../common/EmptyState'
import ErrorAlert from '../common/ErrorAlert'
import LoadingState from '../common/LoadingState'
import ReportCard from './ReportCard'

/**
 * Responsive grid of ReportCards with loading / error / empty handling.
 * `renderActions(report)` lets a page attach role-specific buttons to each card.
 *
 * With `pageSize`, only that many cards show at first, with a "Load more" button under them that
 * shows the next set. The list still arrives whole (newest first) from the service, so this paces
 * the page, not the network. Remount the grid (a new `key`) to start again from the first set, as
 * the dashboards' board does when a filter changes.
 */
export default function ReportGrid({
  reports,
  loading,
  error,
  onRetry,
  renderActions,
  showAuthor = false,
  emptyTitle = 'No reports',
  emptyDescription,
  emptyAction,
  pageSize,
}) {
  const [shown, setShown] = useState(pageSize ?? Infinity)

  if (loading && !reports) return <LoadingState label="Loading reports…" />
  if (error) return <ErrorAlert error={error} onRetry={onRetry} />
  if (!reports?.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
  }

  const visible = reports.slice(0, shown)
  return (
    <>
      <Grid container spacing={2} sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}>
        {visible.map((report) => (
          <Grid key={report.reportId} size={{ xs: 12, sm: 6, lg: 4 }}>
            <ReportCard report={report} showAuthor={showAuthor} actions={renderActions?.(report)} />
          </Grid>
        ))}
      </Grid>
      {visible.length < reports.length && (
        <Stack alignItems="center" spacing={1} sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary" aria-live="polite">
            Showing {visible.length} of {reports.length}
          </Typography>
          <Button variant="outlined" onClick={() => setShown((n) => n + pageSize)}>
            Load more
          </Button>
        </Stack>
      )}
    </>
  )
}
