import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ErrorAlert from '../../components/common/ErrorAlert'
import LoadingState from '../../components/common/LoadingState'
import PageHeader from '../../components/common/PageHeader'
import { useAsync } from '../../hooks/useAsync'
import * as commonCasesService from '../../services/commonCasesService'

/** `/common-cases` (all roles) — dropdown of reference links for recurring problems. */
export default function CommonCasesPage() {
  const { data, loading, error, reload } = useAsync(() => commonCasesService.listCommonCases(), [])
  const [category, setCategory] = useState('')

  const categories = useMemo(() => [...new Set((data ?? []).map((c) => c.category))].sort(), [data])
  const visible = (data ?? []).filter((c) => !category || c.category === category)

  return (
    <>
      <PageHeader title="Common Cases" subtitle="Reference pages for problems that come up again and again. Check here before starting from scratch." />
      <Alert severity="info" sx={{ mb: 2, maxWidth: 760 }}>
        Links are bundled with the app; there is no backend for them yet.
      </Alert>

      {loading && !data && <LoadingState />}
      <ErrorAlert error={error} onRetry={reload} />

      {data && (
        <Card sx={{ maxWidth: 760 }}>
          <CardContent>
            <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ mb: 2, maxWidth: 320 }}>
              <MenuItem value="">All categories</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <List disablePadding>
              {visible.map((c) => (
                <ListItem key={c.id} divider secondaryAction={<Chip label={c.category} size="small" variant="outlined" />}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <OpenInNewIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Link href={c.url} target="_blank" rel="noopener noreferrer" underline="hover">
                        {c.title}
                      </Link>
                    }
                    secondary={c.url}
                    slotProps={{ secondary: { noWrap: true } }}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </>
  )
}
