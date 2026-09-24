import { useState } from 'react'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import PanToolIcon from '@mui/icons-material/PanTool'
import { useSubmit } from '../../hooks/useSubmit'
import { formatDateTime, formatRelative, initials } from '../../utils/format'
import ErrorAlert from '../common/ErrorAlert'

const EVENT_ICONS = {
  status: SwapHorizIcon,
  assignment: PersonAddIcon,
  request: PanToolIcon,
}

function CommentEntry({ entry, isAuthor }) {
  return (
    <Stack direction="row" spacing={1.5}>
      <Avatar sx={{ width: 36, height: 36, fontSize: 13, bgcolor: isAuthor ? 'secondary.main' : 'primary.main' }}>
        {initials(entry.author?.name)}
      </Avatar>
      <Paper variant="outlined" sx={{ flex: 1, overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2">{entry.author?.name ?? 'Unknown'}</Typography>
          {isAuthor && <Chip label="Reporter" size="small" variant="outlined" />}
          <Tooltip title={formatDateTime(entry.createdAt)}>
            <Typography variant="caption" color="text.secondary">
              commented {formatRelative(entry.createdAt)}
            </Typography>
          </Tooltip>
        </Box>
        <Typography variant="body2" sx={{ px: 2, py: 1.5, whiteSpace: 'pre-wrap' }}>
          {entry.body}
        </Typography>
      </Paper>
    </Stack>
  )
}

function EventEntry({ entry }) {
  const Icon = EVENT_ICONS[entry.kind] ?? SwapHorizIcon
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pl: 0.5 }}>
      <Avatar sx={{ width: 28, height: 28, bgcolor: 'grey.200', color: 'text.secondary', ml: 0.5 }}>
        <Icon sx={{ fontSize: 16 }} />
      </Avatar>
      <Typography variant="body2" color="text.secondary">
        <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {entry.author?.name ?? 'System'}
        </Box>{' '}
        {entry.kind === 'status' ? (
          <>
            changed status <Chip label={entry.body} size="small" sx={{ fontFamily: 'monospace', mx: 0.5 }} />
          </>
        ) : (
          (entry.body ?? '').charAt(0).toLowerCase() + (entry.body ?? '').slice(1)
        )}
        <Tooltip title={formatDateTime(entry.createdAt)}>
          <Box component="span" sx={{ ml: 1 }}>
            {formatRelative(entry.createdAt)}
          </Box>
        </Tooltip>
      </Typography>
    </Stack>
  )
}

/**
 * GitHub-issue-style feed: comments as cards, status/assignment/request events inline, plus a
 * composer at the bottom. `onComment(body)` must resolve once the comment is saved.
 */
export default function ActivityThread({ activity = [], reportAuthorId, onComment, disabled = false }) {
  const [draft, setDraft] = useState('')
  const [submit, { submitting, error }] = useSubmit(async (body) => {
    await onComment(body)
    setDraft('')
  })

  return (
    <Stack spacing={2.5} component="section" aria-label="Activity">
      {activity.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No activity yet.
        </Typography>
      )}
      {activity.map((entry) =>
        entry.kind === 'comment' ? (
          <CommentEntry key={entry.activityId} entry={entry} isAuthor={entry.authorId === reportAuthorId} />
        ) : (
          <EventEntry key={entry.activityId} entry={entry} />
        ),
      )}

      {onComment && (
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault()
            if (draft.trim()) submit(draft)
          }}
          sx={{ pt: 1, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <TextField
            label="Add a comment"
            multiline
            minRows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={disabled || submitting}
            placeholder="Share an update, ask a question, or note what you tried…"
          />
          <ErrorAlert error={error} sx={{ mt: 1 }} />
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
            <Button type="submit" variant="contained" disabled={disabled || !draft.trim()} loading={submitting}>
              Comment
            </Button>
          </Stack>
        </Box>
      )}
    </Stack>
  )
}
