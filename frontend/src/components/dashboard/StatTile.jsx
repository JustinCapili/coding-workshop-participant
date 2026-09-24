import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'

/**
 * Headline-number tile. The value and label wear text ink (not a series colour); the icon
 * carries the category.
 */
export default function StatTile({ label, value, hint, icon: Icon, loading = false }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {label}
          </Typography>
          {Icon && <Icon fontSize="small" sx={{ color: 'text.secondary' }} aria-hidden />}
        </Stack>
        {loading ? (
          <Skeleton variant="text" width={72} height={48} />
        ) : (
          <Typography variant="h4" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Typography>
        )}
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
