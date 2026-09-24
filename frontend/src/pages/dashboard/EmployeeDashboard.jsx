import { useRef } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import ListAltIcon from '@mui/icons-material/ListAlt'
import ActionCard from '../../components/dashboard/ActionCard'
import PageHeader from '../../components/common/PageHeader'
import ReportGrid from '../../components/reports/ReportGrid'
import { oldestFirst } from '../../domain/reportOrder'
import { useAsync } from '../../hooks/useAsync'
import * as reportsService from '../../services/reportsService'
import { DASHBOARD_PAGE_SIZE } from './pageSize'

/**
 * Employee dashboard: two entry points (create a report / see my report statuses) and the
 * employee's own reports with their current ReportStatus, oldest filed first, a set at a time.
 */
export default function EmployeeDashboard({ user }) {
  const myReportsRef = useRef(null)
  const { data, loading, error, reload } = useAsync(
    () =>
      reportsService
        .listReports({ viewer: user })
        .then((all) => oldestFirst(all.filter((r) => r.authorId === user.employeeId))),
    [user],
  )

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(' ')[0]}`} subtitle="Report a problem or check on one you have already filed." />

      <Grid container spacing={2} sx={{ mb: 5 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <ActionCard
            title="Create Incident Report"
            description="Something broken, unsafe or not working? File a report and the right engineer will be assigned."
            to="/reports/new"
            icon={AddCircleOutlineIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <ActionCard
            title="Previous report statuses"
            description="See where each of your reports is in the process, read updates and add comments."
            icon={ListAltIcon}
            onClick={() => myReportsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
        </Grid>
      </Grid>

      <Box ref={myReportsRef} component="section" aria-labelledby="my-reports-title" sx={{ scrollMarginTop: 88 }}>
        <Typography id="my-reports-title" variant="h5" component="h2" sx={{ mb: 2 }}>
          My reports
        </Typography>
        <ReportGrid
          pageSize={DASHBOARD_PAGE_SIZE}
          reports={data}
          loading={loading}
          error={error}
          onRetry={reload}
          emptyTitle="You have not filed any reports yet"
          emptyDescription="Your reports and their statuses will show up here."
          emptyAction={
            <Button component={RouterLink} to="/reports/new" variant="contained">
              Create Incident Report
            </Button>
          }
        />
      </Box>
    </>
  )
}
