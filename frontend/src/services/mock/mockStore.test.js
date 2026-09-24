/**
 * setupTests.js replaces delay() with an instant one; everything else it passes through from the
 * real module, which is what `store` is here. Cases about loading from localStorage need a copy of
 * the module that has not built its db yet, so they load one with `fresh()`.
 */
import * as fixtures from './fixtures'

const store = jest.requireActual('./mockStore')

const STORAGE_KEY = 'acme-incident-mock-db-v1'
const COLLECTIONS = ['employees', 'reports', 'assignments', 'activity', 'assignmentRequests', 'closeRequests']

const persisted = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY))
// A fresh module also re-imports the fixtures, whose timestamps are relative to import time.
const reportIds = (db) => db.reports.map((r) => r.reportId)

function fresh() {
  let mod
  jest.isolateModules(() => {
    mod = jest.requireActual('./mockStore')
  })
  return mod
}

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('getDb', () => {
  it('holds a copy of every fixture collection', () => {
    const db = store.getDb()
    for (const name of COLLECTIONS) {
      expect(db[name]).toEqual(fixtures[name])
      expect(db[name]).not.toBe(fixtures[name])
      expect(db[name][0]).not.toBe(fixtures[name][0])
    }
  })

  it('returns the same db on every call', () => {
    expect(store.getDb()).toBe(store.getDb())
  })

  it('leaves the fixtures alone when the db is changed', () => {
    store.getDb().reports[0].title = 'Changed'
    expect(fixtures.reports[0].title).not.toBe('Changed')
  })
})

describe('commit and resetDb', () => {
  it('commit persists the db to localStorage', () => {
    store.getDb().reports[0].title = 'Persisted'
    store.commit()
    expect(persisted().reports[0].title).toBe('Persisted')
  })

  it('commit ignores a storage failure', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => store.commit()).not.toThrow()
  })

  it('resetDb throws away changes and persists the seed', () => {
    store.getDb().reports.length = 0
    store.resetDb()
    expect(store.getDb().reports).toEqual(fixtures.reports)
    expect(persisted().reports).toEqual(fixtures.reports)
  })
})

describe('loading on first use', () => {
  it('does not touch storage until the db is first used', () => {
    window.localStorage.clear()
    const mod = fresh()
    mod.commit()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('restores the db saved by an earlier session', () => {
    const saved = { ...persisted(), reports: [{ reportId: 'RPT-SAVED' }] }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))

    expect(fresh().getDb().reports).toEqual([{ reportId: 'RPT-SAVED' }])
  })

  it('seeds afresh when nothing is saved', () => {
    window.localStorage.clear()
    expect(fresh().getDb().employees).toEqual(fixtures.employees)
  })

  it('seeds afresh when the saved db is missing a collection', () => {
    const { closeRequests: _dropped, ...partial } = persisted()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...partial, reports: [] }))

    expect(reportIds(fresh().getDb())).toEqual(reportIds(fixtures))
  })

  it('seeds afresh when the saved db is corrupt', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json')
    expect(reportIds(fresh().getDb())).toEqual(reportIds(fixtures))
  })

  it('seeds afresh when storage cannot be read', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(reportIds(fresh().getDb())).toEqual(reportIds(fixtures))
  })
})

describe('nextId', () => {
  it('makes distinct, increasing ids with the given prefix', () => {
    const a = store.nextId('RPT')
    const b = store.nextId('RPT')
    expect(a).toMatch(/^RPT-\d+$/)
    expect(b).toMatch(/^RPT-\d+$/)
    expect(Number(b.split('-')[1])).toBe(Number(a.split('-')[1]) + 1)
    expect(store.nextId('ACT')).toMatch(/^ACT-\d+$/)
  })
})

describe('delay', () => {
  it('resolves after the given time, 250ms by default', async () => {
    jest.useFakeTimers()
    const done = jest.fn()

    store.delay().then(done)
    await jest.advanceTimersByTimeAsync(249)
    expect(done).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(done).toHaveBeenCalled()

    const later = jest.fn()
    store.delay(1000).then(later)
    await jest.advanceTimersByTimeAsync(999)
    expect(later).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(later).toHaveBeenCalled()
  })
})
