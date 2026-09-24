/**
 * The app as a user sees it: find things by their visible label or text, the way a person would,
 * and wait for them explicitly. No fixed sleeps and no implicit waits anywhere in the suite.
 *
 * MUI specifics handled here, so specs do not have to know them:
 * - A required field's label ends in a thin space and an asterisk ("Title *"), which labels are
 *   matched without.
 * - Selects and autocompletes are comboboxes that open a listbox of options.
 * - Hidden duplicates (the sidebar is rendered twice, one copy hidden) are skipped: only
 *   displayed elements count.
 * - A snackbar can sit over the button to click next; a click it intercepts is retried directly.
 */
import { By, Key, error as seleniumErrors } from 'selenium-webdriver'
import { BASE_URL } from './config'

const WAIT_MS = 20000

/** An XPath string literal for any text, including one with both kinds of quote. */
function literal(text) {
  if (!text.includes("'")) return `'${text}'`
  if (!text.includes('"')) return `"${text}"`
  return `concat('${text.split("'").join(`', "'", '`)}')`
}

/** normalize-space() of the node's text with MUI's required-field asterisk removed. */
const LABEL_TEXT = "normalize-space(translate(., '* ', ''))"

export class App {
  /** @param {import('selenium-webdriver').WebDriver} driver */
  constructor(driver) {
    this.driver = driver
  }

  // ---- finding ----------------------------------------------------------------------------

  /** Waits for the first displayed element matching the XPath and returns it. */
  async find(xpath, { timeout = WAIT_MS, what = xpath } = {}) {
    let found = null
    try {
      await this.driver.wait(async () => {
        for (const element of await this.driver.findElements(By.xpath(xpath))) {
          try {
            if (await element.isDisplayed()) {
              found = element
              return true
            }
          } catch (err) {
            if (!(err instanceof seleniumErrors.StaleElementReferenceError)) throw err
          }
        }
        return false
      }, timeout)
    } catch (err) {
      if (err instanceof seleniumErrors.TimeoutError) {
        throw new Error(`Timed out after ${timeout} ms waiting for ${what} on ${await this.path()}`, {
          cause: err,
        })
      }
      throw err
    }
    return found
  }

  /** Waits until nothing matching the XPath is displayed. */
  async gone(xpath, { timeout = WAIT_MS, what = xpath } = {}) {
    await this.driver.wait(
      async () => {
        for (const element of await this.driver.findElements(By.xpath(xpath))) {
          try {
            if (await element.isDisplayed()) return false
          } catch {
            // Stale: it left the page, which is what we are waiting for.
          }
        }
        return true
      },
      timeout,
      `${what} still shown on ${await this.path()}`,
    )
  }

  /** The input, textarea or combobox a visible label points at. */
  async field(label) {
    const labelElement = await this.find(`//label[${LABEL_TEXT}=${literal(label)}]`, {
      what: `a field labelled "${label}"`,
    })
    const id = await labelElement.getAttribute('for')
    return this.driver.findElement(By.id(id))
  }

  /** A button (or a link styled as one) with exactly this text. */
  button(name, { within = '' } = {}) {
    return this.find(
      `${within}//*[self::button or self::a or @role='button' or @role='menuitem'][normalize-space(.)=${literal(name)}]`,
      { what: `the "${name}" button` },
    )
  }

  // ---- doing --------------------------------------------------------------------------------

  async visit(pathname) {
    await this.driver.get(`${BASE_URL}${pathname}`)
  }

  async click(element) {
    await this.driver.executeScript('arguments[0].scrollIntoView({block: "center"})', element)
    try {
      await element.click()
    } catch (err) {
      if (!(err instanceof seleniumErrors.ElementClickInterceptedError)) throw err
      await this.driver.executeScript('arguments[0].click()', element)
    }
  }

  async press(name, options) {
    await this.click(await this.button(name, options))
  }

  /**
   * Presses the button named `name` in the nearest container around `anchor`, an XPath for
   * something that identifies one row or card, such as the link to a particular report. For pages
   * that repeat the same button once per row.
   */
  async pressNear(anchor, name) {
    const button = `*[self::button or self::a][normalize-space(.)=${literal(name)}]`
    await this.click(
      await this.find(`${anchor}/ancestor-or-self::*[.//${button}][1]//${button}`, {
        what: `the "${name}" button next to ${anchor}`,
      }),
    )
  }

  /** The labels of the links in the visible sidebar. */
  async sidebarLinks() {
    const nav = await this.find(`//nav[@aria-label='Main navigation']`, { what: 'the sidebar' })
    const links = await nav.findElements(By.css('a'))
    return Promise.all(links.map((link) => link.getText()))
  }

  /** Replaces a text field's value. React only sees real key events, so no element.clear(). */
  async fill(label, value) {
    const input = await this.field(label)
    await input.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE)
    await input.sendKeys(value)
  }

  /** Picks an option in a select (a combobox that opens a listbox). */
  async choose(label, option) {
    const labelElement = await this.find(`//label[${LABEL_TEXT}=${literal(label)}]`, {
      what: `a select labelled "${label}"`,
    })
    const labelId = await labelElement.getAttribute('id')
    await this.click(
      await this.find(`//*[@role='combobox' and contains(@aria-labelledby, ${literal(labelId)})]`),
    )
    await this.click(
      await this.find(`//li[@role='option' and normalize-space(.)=${literal(option)}]`, {
        what: `the "${option}" option`,
      }),
    )
  }

  /** Types into an autocomplete and picks the first option containing `text`. */
  async pick(label, text) {
    const input = await this.field(label)
    await this.click(input)
    await input.sendKeys(text)
    await this.click(
      await this.find(`//li[@role='option' and contains(normalize-space(.), ${literal(text)})]`, {
        what: `an option containing "${text}"`,
      }),
    )
  }

  // ---- checking -----------------------------------------------------------------------------

  async path() {
    return new URL(await this.driver.getCurrentUrl()).pathname
  }

  /** Waits until the path matches, and returns it. */
  async waitForPath(pattern) {
    await this.driver.wait(
      async () => pattern.test(await this.path()),
      WAIT_MS,
      `Expected a path matching ${pattern}`,
    )
    return this.path()
  }

  heading(text) {
    return this.find(
      `//*[self::h1 or self::h2][normalize-space(.)=${literal(text)}]`,
      { what: `the heading "${text}"` },
    )
  }

  text(text) {
    return this.find(`//*[contains(normalize-space(.), ${literal(text)}) and not(self::script)]`, {
      what: `the text "${text}"`,
    })
  }

  /** An alert (errors, notices and the snackbar are all MUI Alerts) containing the text. */
  alert(text) {
    return this.find(`//*[@role='alert'][contains(normalize-space(.), ${literal(text)})]`, {
      what: `an alert saying "${text}"`,
    })
  }

  /** The report's status chip on its detail page, e.g. "Unassigned", "In progress". */
  status(label) {
    return this.find(`//*[contains(@class, 'MuiChip-root')][normalize-space(.)=${literal(label)}]`, {
      what: `the status "${label}"`,
    })
  }

  // ---- journeys shared by every spec -------------------------------------------------------

  /** Forgets whoever is signed in, as closing the tab would, and loads the login page. */
  async freshLogin() {
    await this.visit('/login')
    await this.driver.executeScript('window.sessionStorage.clear()')
    await this.driver.navigate().refresh()
  }

  /**
   * Signs in through the login form. It starts from a fresh login page, so a test that failed
   * before signing out cannot leave the next one signed in as somebody else. With `{ here: true }`
   * it uses the form already on screen instead, so a redirect's "come back to" location is kept,
   * as when a signed-out user follows a deep link.
   */
  async signIn(email, password, { here = false } = {}) {
    if (!here) await this.freshLogin()
    await this.fill('Employee email', email)
    await this.fill('Password', password)
    await this.press('Sign in')
    await this.waitForPath(/^\/(?!login)/)
  }

  async openAccountMenu() {
    await this.click(await this.find(`//button[@aria-label='Account menu']`, { what: 'the account menu' }))
  }

  async signOut() {
    await this.openAccountMenu()
    await this.press('Log out')
    await this.waitForPath(/^\/login$/)
  }

  /** Self-service sign-up through the login card's "Create an account". */
  async register(email, password) {
    await this.freshLogin()
    await this.press('Create an account')
    await this.fill('Employee email', email)
    await this.fill('Password', password)
    await this.fill('Confirm password', password)
    await this.press('Create account')
    await this.waitForPath(/^\/dashboard$/)
  }

  /** Files a report from /reports/new and returns its id, read from the detail page's URL. */
  async fileReport({ title, type = 'IT', location, description }) {
    await this.visit('/reports/new')
    await this.fill('Title', title)
    await this.choose('Type of incident', type)
    await this.fill('Location', location)
    if (description) await this.fill('Description', description)
    await this.press('Submit report')
    // Not /reports/new itself, which the pattern would otherwise match before submit navigates.
    const pathname = await this.waitForPath(/^\/reports\/(?!new$)[^/]+$/)
    await this.heading(title)
    return pathname.split('/').pop()
  }

  async openReport(reportId, title) {
    await this.visit(`/reports/${reportId}`)
    await this.heading(title)
  }
}
