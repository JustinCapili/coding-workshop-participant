import { oldestFirst } from './reportOrder'

const at = (iso) => `2026-09-${iso}T09:00:00Z`

describe('oldestFirst', () => {
  it('puts the earliest filed report first, without changing the list it was given', () => {
    const reports = [
      { reportId: 'RPT-3', createdAt: at('20') },
      { reportId: 'RPT-1', createdAt: at('01') },
      { reportId: 'RPT-2', createdAt: at('10') },
    ]

    expect(oldestFirst(reports).map((r) => r.reportId)).toEqual(['RPT-1', 'RPT-2', 'RPT-3'])
    expect(reports.map((r) => r.reportId)).toEqual(['RPT-3', 'RPT-1', 'RPT-2'])
  })

  it('orders reports filed in the same moment by id, so the order is stable', () => {
    const reports = [
      { reportId: 'RPT-B', createdAt: at('05') },
      { reportId: 'RPT-A', createdAt: at('05') },
    ]

    expect(oldestFirst(reports).map((r) => r.reportId)).toEqual(['RPT-A', 'RPT-B'])
  })

  it('treats a report with no filing time as the oldest', () => {
    const reports = [{ reportId: 'RPT-1', createdAt: at('01') }, { reportId: 'RPT-0' }]

    expect(oldestFirst(reports).map((r) => r.reportId)).toEqual(['RPT-0', 'RPT-1'])
  })
})
