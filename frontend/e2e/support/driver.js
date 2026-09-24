/**
 * Starts a browser for a spec.
 *
 * Selenium Manager (bundled with selenium-webdriver) finds or downloads the driver and the browser,
 * so nothing needs installing by hand; globalSetup.js configures it (see there for why).
 */
import { Builder } from 'selenium-webdriver'
import { Options as ChromeOptions } from 'selenium-webdriver/chrome'
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox'
import { BROWSER, HEADED } from './config'

// Wide enough for the permanent sidebar (MUI's md breakpoint is 900px).
const WIDTH = 1280
const HEIGHT = 900

export async function startBrowser() {
  const builder = new Builder().forBrowser(BROWSER)
  if (BROWSER === 'chrome') {
    const options = new ChromeOptions().addArguments(`--window-size=${WIDTH},${HEIGHT}`)
    if (!HEADED) options.addArguments('--headless=new')
    builder.setChromeOptions(options)
  } else {
    const options = new FirefoxOptions().windowSize({ width: WIDTH, height: HEIGHT })
    if (!HEADED) options.addArguments('-headless')
    builder.setFirefoxOptions(options)
  }
  return builder.build()
}
