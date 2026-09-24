import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import InboxIcon from '@mui/icons-material/Inbox'

export default function EmptyState({ title = 'Nothing here yet', description, action, icon: Icon = InboxIcon }) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 6,
        px: 2,
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 2,
        color: 'text.secondary',
      }}
    >
      <Icon sx={{ fontSize: 40, mb: 1, opacity: 0.6 }} />
      <Typography variant="h6" color="text.primary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ mt: 0.5, mb: action ? 2 : 0 }}>
          {description}
        </Typography>
      )}
      {action}
    </Box>
  )
}
