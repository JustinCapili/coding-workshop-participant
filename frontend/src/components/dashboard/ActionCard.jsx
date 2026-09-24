import { Link as RouterLink } from 'react-router-dom'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

/** Large clickable entry-point card for dashboard grids. */
export default function ActionCard({ title, description, to, icon: Icon, onClick }) {
  const linkProps = to ? { component: RouterLink, to } : { onClick }
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea {...linkProps} sx={{ height: '100%', alignItems: 'stretch' }}>
        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, p: 3 }}>
          {Icon && <Icon color="primary" sx={{ fontSize: 36 }} aria-hidden />}
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            {description}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'primary.main', fontWeight: 600 }}>
            <Typography variant="button">Open</Typography>
            <ArrowForwardIcon fontSize="small" />
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
