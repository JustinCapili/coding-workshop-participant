import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { errorMessage } from '../../services/apiError'

export default function ErrorAlert({ error, onRetry, sx }) {
  if (!error) return null
  return (
    <Alert
      severity="error"
      sx={sx}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      {errorMessage(error)}
    </Alert>
  )
}
