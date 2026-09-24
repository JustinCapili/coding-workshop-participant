import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

export default function LoadingState({ label = 'Loading…', minHeight = 160 }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight }}
    >
      <CircularProgress size={24} />
      <Typography color="text.secondary">{label}</Typography>
    </Box>
  )
}
