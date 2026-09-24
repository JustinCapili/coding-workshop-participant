import { formatDate, formatDateTime, formatRelative, initials, todayIso } from './format'

// Output depends on the machine's locale and time zone, so expectations use the same Intl calls.
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const relativeFmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const NOW = new Date('2026-03-15T12:00:00Z').getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const at = (offsetMs) => new Date(NOW + offsetMs).toISOString()

describe('formatDateTime and formatDate', () => {
  const iso = '2026-03-15T09:30:00Z'

  it('format an ISO timestamp as a medium date, with and without the time', () => {
    expect(formatDateTime(iso)).toBe(dateTimeFmt.format(new Date(iso)))
    expect(formatDate(iso)).toBe(dateFmt.format(new Date(iso)))
  })

  it('show a dash for a missing timestamp', () => {
    for (const empty of [null, undefined, '']) {
      expect(formatDateTime(empty)).toBe('—')
      expect(formatDate(empty)).toBe('—')
    }
  })
})

describe('formatRelative', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('shows a dash for a missing timestamp', () => {
    expect(formatRelative(null)).toBe('—')
  })

  it('says "just now" within a minute either side', () => {
    expect(formatRelative(at(-30_000))).toBe('just now')
    expect(formatRelative(at(59_000))).toBe('just now')
  })

  it('counts minutes under an hour', () => {
    expect(formatRelative(at(-5 * MINUTE))).toBe(relativeFmt.format(-5, 'minute'))
    expect(formatRelative(at(10 * MINUTE))).toBe(relativeFmt.format(10, 'minute'))
  })

  it('counts hours under a day', () => {
    expect(formatRelative(at(-3 * HOUR))).toBe(relativeFmt.format(-3, 'hour'))
  })

  it('counts days under thirty days', () => {
    expect(formatRelative(at(-1 * DAY))).toBe(relativeFmt.format(-1, 'day'))
    expect(formatRelative(at(-14 * DAY))).toBe(relativeFmt.format(-14, 'day'))
  })

  it('falls back to the date from thirty days on', () => {
    const iso = at(-30 * DAY)
    expect(formatRelative(iso)).toBe(dateFmt.format(new Date(iso)))
  })
})

describe('initials', () => {
  it('takes the first letter of the first two words, upper-cased', () => {
    expect(initials('alice nguyen')).toBe('AN')
    expect(initials('Ada  Mary   Whitfield')).toBe('AM')
  })

  it('copes with a single name, extra whitespace and no name', () => {
    expect(initials('  bob ')).toBe('B')
    expect(initials('')).toBe('')
    expect(initials()).toBe('')
  })
})

describe('todayIso', () => {
  it("is today's UTC date as yyyy-mm-dd", () => {
    jest.useFakeTimers({ now: new Date('2026-03-15T23:59:00Z') })
    try {
      expect(todayIso()).toBe('2026-03-15')
    } finally {
      jest.useRealTimers()
    }
  })
})
