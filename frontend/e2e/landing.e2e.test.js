/**
 * The landing page in a real browser: what a signed-out visitor sees at /, a pin's report card,
 * the two ways in, and that it fits a phone without scrolling sideways. A signed-in visitor goes
 * straight past it to their dashboard.
 */
import { By } from 'selenium-webdriver'
import { useBrowser } from './support/browser'
import { ADMIN } from './support/config'

const HEADLINE = 'See something? Say something.'

describe('the landing page', () => {
  const session = useBrowser()

  it('greets a signed-out visitor at / and shows a focused pin’s report', async () => {
    const { app, driver } = session
    await app.freshLogin()
    await app.visit('/')
    await app.heading(HEADLINE)

    const pin = await app.find(`//button[starts-with(@aria-label, 'Safety incident in Hall B')]`, {
      what: 'the Hall B pin',
    })
    await driver.executeScript('arguments[0].focus()', pin)
    await driver.wait(
      async () => (await pin.getAttribute('aria-describedby')) === 'blueprint-incident-card',
      5000,
      'Expected the focused pin to own the report card',
    )
    // The card fades in, and Selenium reads no text from it until it is visible.
    const card = await driver.findElement(By.id('blueprint-incident-card'))
    await driver.wait(
      async () => (await card.getText()).includes('Wet floor by the east stairs'),
      5000,
      'Expected the card to show the Hall B report',
    )
    expect(await card.getText()).toContain('High priority')
  })

  it('opens the sign-up form from Create your account, and sign-in from Sign in', async () => {
    const { app } = session
    await app.visit('/')
    await app.press('Create your account')
    await app.waitForPath(/^\/login$/)
    await app.field('Confirm password')

    await app.visit('/')
    await app.heading(HEADLINE)
    await app.press('Sign in')
    await app.waitForPath(/^\/login$/)
    await app.button('Sign in')
  })

  it('sends a signed-in visitor at / straight to their dashboard', async () => {
    const { app } = session
    await app.signIn(ADMIN.email, ADMIN.password)
    await app.visit('/')
    await app.waitForPath(/^\/dashboard$/)
    await app.signOut()
  })

  it('fits a phone-sized window without sideways scrolling', async () => {
    const { app, driver } = session
    const original = await driver.manage().window().getRect()
    try {
      await driver.manage().window().setRect({ width: 375, height: 812 })
      await app.freshLogin()
      await app.visit('/')
      await app.heading(HEADLINE)
      await app.find(`//*[@id='blueprint-incident-card']`, { what: 'the report card' })

      const overflow = await driver.executeScript(
        'return document.documentElement.scrollWidth - document.documentElement.clientWidth',
      )
      expect(overflow).toBeLessThanOrEqual(0)
    } finally {
      await driver.manage().window().setRect({ width: original.width, height: original.height })
    }
  })
})
