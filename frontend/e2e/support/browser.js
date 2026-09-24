/**
 * One browser for the tests in a describe block: started before them, quit after them, and
 * captured to e2e/artifacts/ whenever one of them fails. A spec that needs two people signed in at
 * once calls it twice.
 */
import { captureOnFailure } from './artifacts'
import { startBrowser } from './driver'
import { App } from './ui'

/**
 * @param {string} label names the artifacts when there is more than one browser
 * @returns {{ app: App, driver: import('selenium-webdriver').WebDriver }} filled in by beforeAll
 */
export function useBrowser(label = 'browser') {
  const session = {}
  beforeAll(async () => {
    session.driver = await startBrowser()
    session.app = new App(session.driver)
  })
  afterAll(async () => {
    await session.driver?.quit()
  })
  captureOnFailure(() => ({ [label]: session.driver }))
  return session
}
