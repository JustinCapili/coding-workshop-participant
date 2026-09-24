import { commonCases } from '../content/commonCases'
import { listCommonCases } from './commonCasesService'

describe('listCommonCases', () => {
  it('serves the reference links bundled with the app', async () => {
    const cases = await listCommonCases()
    expect(cases).toBe(commonCases)
    expect(cases.length).toBeGreaterThan(0)
    for (const c of cases) {
      expect(c).toEqual({
        id: expect.any(String),
        title: expect.any(String),
        category: expect.any(String),
        url: expect.stringMatching(/^https:\/\//),
      })
    }
  })
})
