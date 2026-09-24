/**
 * Saves what a failed test's browser was showing: a PNG screenshot and the page source, under
 * e2e/artifacts/, named after the test. environment.cjs sets the failure flag this reads.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DIR = path.resolve(__dirname, '..', 'artifacts')

function fileStem(label) {
  const test = expect.getState().currentTestName ?? 'unknown test'
  return `${test} ${label}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 150)
}

/**
 * Registers an afterEach that captures every open browser when the test failed.
 *
 * @param {() => Record<string, import('selenium-webdriver').WebDriver | undefined>} browsers
 *     the spec's browsers by label, read at the time of the failure
 */
export function captureOnFailure(browsers) {
  afterEach(async () => {
    if (!globalThis.__E2E_TEST_FAILED__) return
    await mkdir(DIR, { recursive: true })
    for (const [label, driver] of Object.entries(browsers())) {
      if (!driver) continue
      const stem = path.join(DIR, fileStem(label))
      try {
        await writeFile(`${stem}.png`, await driver.takeScreenshot(), 'base64')
        await writeFile(`${stem}.html`, await driver.getPageSource())
        console.log(`Saved ${stem}.png and .html (URL: ${await driver.getCurrentUrl()})`)
      } catch (err) {
        console.log(`Could not capture ${label}: ${err.message}`)
      }
    }
  })
}
