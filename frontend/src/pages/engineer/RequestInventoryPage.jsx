import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import SendIcon from '@mui/icons-material/Send'
import { useAuth } from '../../auth/useAuth'
import EmptyState from '../../components/common/EmptyState'
import ErrorAlert from '../../components/common/ErrorAlert'
import PageHeader from '../../components/common/PageHeader'
import { useAsync } from '../../hooks/useAsync'
import { useSubmit } from '../../hooks/useSubmit'
import * as inventoryService from '../../services/inventoryService'
import { INVENTORY_AVAILABLE } from '../../services/inventoryService'
import * as reportsService from '../../services/reportsService'
import { formatRelative } from '../../utils/format'

function Bubble({ align, children, meta }) {
  const mine = align === 'right'
  return (
    <Stack alignItems={mine ? 'flex-end' : 'flex-start'}>
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1.25,
          maxWidth: '80%',
          bgcolor: mine ? 'primary.main' : 'action.hover',
          color: mine ? 'primary.contrastText' : 'text.primary',
          borderRadius: 3,
          borderBottomRightRadius: mine ? 4 : 12,
          borderBottomLeftRadius: mine ? 12 : 4,
        }}
      >
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {children}
        </Typography>
      </Paper>
      {meta && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {meta}
        </Typography>
      )}
    </Stack>
  )
}

const TITLE = 'Request Inventory'
const SUBTITLE = 'Ask for the parts or supplies you need to resolve an incident. Requests go to the inventory team.'

/**
 * `/inventory/request` (Engineer+) — chat-style box for requesting parts.
 *
 * There is no inventory backend, so the chat only exists in mock mode (VITE_USE_MOCKS=true).
 * Against the real backend the page says so and never touches mock data.
 */
export default function RequestInventoryPage() {
  if (!INVENTORY_AVAILABLE) {
    return (
      <>
        <PageHeader title={TITLE} subtitle={SUBTITLE} />
        <Box sx={{ maxWidth: 760 }}>
          <EmptyState
            icon={Inventory2Icon}
            title="Inventory requests aren't available yet"
            description="There is no inventory service behind this page yet. Ask your faculty admin for parts in the meantime."
          />
        </Box>
      </>
    )
  }
  return <InventoryChat />
}

function InventoryChat() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [reportId, setReportId] = useState('')

  const history = useAsync(() => inventoryService.listInventoryRequests({ requesterId: user.employeeId }), [user])
  const { data: myReports } = useAsync(
    () => reportsService.listReports({ viewer: user, openOnly: true }).then((rows) => rows.filter((r) => r.assignees.some((a) => a.assigneeId === user.employeeId))),
    [user],
  )

  const [submit, { submitting, error }] = useSubmit(async () => {
    await inventoryService.submitInventoryRequest({ query, reportId: reportId || null, requesterId: user.employeeId })
    setQuery('')
    history.reload()
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim()) submit()
  }

  return (
    <>
      <PageHeader title={TITLE} subtitle={SUBTITLE} />
      <Alert severity="info" sx={{ mb: 2, maxWidth: 760 }}>
        Mock mode — no inventory service exists. Requests are kept in this browser only and
        acknowledged so the flow can be demoed.
      </Alert>

      <Card sx={{ maxWidth: 760, display: 'flex', flexDirection: 'column', minHeight: 420 }}>
        <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto' }} aria-live="polite">
          <Stack spacing={2}>
            <Bubble align="left">Hi {user.name.split(' ')[0]}, what do you need? Include quantities and the room the part is for.</Bubble>
            <ErrorAlert error={history.error} onRetry={history.reload} />
            {[...(history.data ?? [])].reverse().map((r) => (
              <Stack key={r.requestId} spacing={1.5}>
                <Bubble align="right" meta={`${formatRelative(r.createdAt)}${r.reportId ? ` · ${r.reportId}` : ''}`}>
                  {r.query}
                </Bubble>
                <Bubble align="left">
                  Request <strong>{r.requestId}</strong> received. Status: <Chip label={r.status} size="small" sx={{ ml: 0.5 }} />
                </Bubble>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={1.5}>
            <TextField select label="Related incident (optional)" value={reportId} onChange={(e) => setReportId(e.target.value)} disabled={submitting}>
              <MenuItem value="">None</MenuItem>
              {(myReports ?? []).map((r) => (
                <MenuItem key={r.reportId} value={r.reportId}>
                  {r.reportId} — {r.title}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                label="What do you need?"
                placeholder="e.g. 2× replacement lamp modules for Epson EB-X41, Room 204"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                multiline
                maxRows={4}
                disabled={submitting}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (query.trim()) submit()
                  }
                }}
              />
              <IconButton type="submit" color="primary" aria-label="Send request" disabled={submitting || !query.trim()} sx={{ mt: 0.25 }}>
                <SendIcon />
              </IconButton>
            </Stack>
            <ErrorAlert error={error} />
          </Stack>
        </Box>
      </Card>
    </>
  )
}
