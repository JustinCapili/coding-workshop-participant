import { useState } from 'react'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import { useAuth } from '../../auth/useAuth'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import EmptyState from '../../components/common/EmptyState'
import ErrorAlert from '../../components/common/ErrorAlert'
import LoadingState from '../../components/common/LoadingState'
import PageHeader from '../../components/common/PageHeader'
import { useSnackbar } from '../../components/feedback/useSnackbar'
import { DEFAULT_ADMIN_EMAIL } from '../../domain/accounts'
import { Role, roleLabel } from '../../domain/roles'
import { useAsync } from '../../hooks/useAsync'
import { useSubmit } from '../../hooks/useSubmit'
import * as employeesService from '../../services/employeesService'
import { initials } from '../../utils/format'

/** Every plain employee and engineer, the people who can be promoted, by name. */
async function loadCandidates() {
  const [employees, engineers] = await Promise.all([
    employeesService.listEmployees(),
    employeesService.listEngineers(),
  ])
  return [...employees, ...engineers].sort((a, b) => a.name.localeCompare(b.name))
}

function matches(person, query) {
  const q = query.trim().toLowerCase()
  return !q || [person.name, person.email, person.employeeId].some((v) => v?.toLowerCase().includes(q))
}

/**
 * `/team/admins` (admin@acme.inc only) — make an employee or an engineer a faculty admin.
 *
 * The route is gated on `isDefaultAdmin`, and the backend refuses anyone else with a 403. A promoted
 * account keeps its id, email and password; an engineer leaves the team they were on.
 */
export default function FacultyAdminsPage() {
  const { user } = useAuth()
  const { notify } = useSnackbar()
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState(null)

  const candidates = useAsync(loadCandidates, [])
  const admins = useAsync(() => employeesService.listFacultyAdmins(), [])

  const [promote, { submitting, error, reset }] = useSubmit(async () => {
    const admin = await employeesService.promoteToFacultyAdmin({
      employeeId: target.employeeId,
      viewer: user,
    })
    setTarget(null)
    notify(`${admin.email} is now a faculty admin`)
    candidates.reload()
    admins.reload()
  })

  const close = () => {
    if (submitting) return
    setTarget(null)
    reset()
  }

  const shown = candidates.data?.filter((p) => matches(p, query)) ?? []

  return (
    <>
      <PageHeader
        title="Faculty Admins"
        subtitle={`Make an employee or engineer a faculty admin. Only ${DEFAULT_ADMIN_EMAIL} can do this.`}
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              Employees and engineers
              {candidates.data && (
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  {candidates.data.length}
                </Typography>
              )}
            </Typography>
            <TextField
              label="Filter by name, email or ID"
              size="small"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {candidates.loading && !candidates.data && <LoadingState minHeight={120} />}
            <ErrorAlert error={candidates.error} onRetry={candidates.reload} />
            {candidates.data && shown.length === 0 && (
              <EmptyState
                title={query ? 'Nobody matches' : 'Nobody to promote'}
                description={query ? 'Try another name, email or ID.' : 'Every account is a faculty admin already.'}
              />
            )}
            {shown.length > 0 && (
              <Card>
                <List disablePadding>
                  {shown.map((p, i) => (
                    <ListItem
                      key={p.employeeId}
                      divider={i < shown.length - 1}
                      secondaryAction={
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AdminPanelSettingsIcon />}
                          onClick={() => setTarget(p)}
                          aria-label={`Make ${p.name} a faculty admin`}
                        >
                          Make Faculty Admin
                        </Button>
                      }
                      sx={{ pr: 26 }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main', fontSize: 13 }}>{initials(p.name)}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <span>{p.name}</span>
                            <Chip size="small" variant="outlined" label={roleLabel(p)} />
                          </Stack>
                        }
                        secondary={`${p.email} · ${p.employeeId}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Card>
            )}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              Faculty admins
              {admins.data && (
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  {admins.data.length}
                </Typography>
              )}
            </Typography>
            {admins.loading && !admins.data && <LoadingState minHeight={120} />}
            <ErrorAlert error={admins.error} onRetry={admins.reload} />
            {admins.data?.length > 0 && (
              <Card>
                <List disablePadding>
                  {admins.data.map((a, i) => (
                    <ListItem key={a.employeeId} divider={i < admins.data.length - 1}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'secondary.main', fontSize: 13 }}>{initials(a.name)}</Avatar>
                      </ListItemAvatar>
                      <ListItemText primary={a.name} secondary={`${a.email} · ${a.employeeId}`} />
                    </ListItem>
                  ))}
                </List>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>

      <ConfirmDialog
        open={Boolean(target)}
        title="Make faculty admin?"
        description={
          target &&
          `${target.name} (${target.email}) becomes a faculty admin. They keep their account and password${
            target.role === Role.ENGINEER && target.facultyAdminId ? ' and leave the team they are on' : ''
          }. This cannot be undone here.`
        }
        confirmLabel="Make Faculty Admin"
        busy={submitting}
        error={error}
        onConfirm={() => promote()}
        onClose={close}
      />
    </>
  )
}
