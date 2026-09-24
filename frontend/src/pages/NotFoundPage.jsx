import { Link as RouterLink } from 'react-router-dom'
import Button from '@mui/material/Button'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import EmptyState from '../components/common/EmptyState'

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={SearchOffIcon}
      title="Page not found"
      description="The link may be out of date, or you may not have access to this page."
      action={
        <Button component={RouterLink} to="/dashboard" variant="contained">
          Go to dashboard
        </Button>
      }
    />
  )
}
