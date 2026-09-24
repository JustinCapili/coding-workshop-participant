/**
 * Adds reports to the mock backend's seeded data, for tests that need more incidents than the
 * fixtures have (the fixtures stop short of a dashboard's page of six).
 */
import { commit, getDb } from '../services/mock/mockStore'

/**
 * Files `count` more open, unassigned reports by Alice (a teamless employee, so every engineer and
 * admin sees them too), titled "Extra report 1" … "Extra report <count>". They were filed a minute
 * apart over the last `count` minutes, so "Extra report 1" is the oldest of them, and all of them
 * are newer than every fixture.
 *
 * @param {number} count how many to add
 * @param {object} [fields] fields to override on every one, such as `location`
 * @returns {string[]} their titles, oldest first
 */
export function fileExtraReports(count, fields = {}) {
  const template = getDb().reports.find((r) => r.reportId === 'RPT-1002')
  const titles = []
  for (let i = 1; i <= count; i += 1) {
    const filed = new Date(Date.now() - (count + 1 - i) * 60 * 1000).toISOString()
    const title = `Extra report ${i}`
    getDb().reports.push({ ...template, reportId: `RPT-9${String(i).padStart(3, '0')}`, title, createdAt: filed, updatedAt: filed, ...fields })
    titles.push(title)
  }
  commit()
  return titles
}
