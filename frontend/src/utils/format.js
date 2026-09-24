const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const relativeFmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function formatDateTime(iso) {
  if (!iso) return '—'
  return dateTimeFmt.format(new Date(iso))
}

export function formatDate(iso) {
  if (!iso) return '—'
  return dateFmt.format(new Date(iso))
}

/** "3 hours ago", "yesterday", "2 weeks ago" */
export function formatRelative(iso) {
  if (!iso) return '—'
  const diffMs = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diffMs)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (abs < minute) return 'just now'
  if (abs < hour) return relativeFmt.format(Math.round(diffMs / minute), 'minute')
  if (abs < day) return relativeFmt.format(Math.round(diffMs / hour), 'hour')
  if (abs < 30 * day) return relativeFmt.format(Math.round(diffMs / day), 'day')
  return dateFmt.format(new Date(iso))
}

/** Two-letter initials for avatars. */
export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/** Today's date as yyyy-mm-dd for <input type="date"> defaults/max. */
export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
