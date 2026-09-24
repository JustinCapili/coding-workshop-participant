/**
 * Oldest filed first: the order the dashboards list incidents in, so the ones that have waited
 * longest are seen first. The services return newest-updated first; this does not change that for
 * other pages. Ties (same second) fall back to the report id, so the order is stable.
 */
export function oldestFirst(reports) {
  const filed = (report) => Date.parse(report.createdAt) || 0
  return [...reports].sort((a, b) => filed(a) - filed(b) || String(a.reportId).localeCompare(String(b.reportId)))
}
