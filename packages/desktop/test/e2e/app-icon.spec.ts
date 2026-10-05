import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// The icon colour is chosen in the Preferences window. The windows' own icons
// cannot be read back from Electron, so these tests follow the choice to the
// stored preference and to the About dialog of an open editor window.

const openThemePreferences = async(app: ElectronApplication): Promise<Page> => {
  const settingsWindow = app.waitForEvent('window')
  await app.evaluate(({ ipcMain }) => {
    ipcMain.emit('app-create-settings-window')
  })
  const settings = await settingsWindow
  await settings.waitForSelector('.pref-container', { timeout: 15000 })
  await settings.evaluate(() => {
    location.hash = '#/preference/theme'
  })
  await settings.waitForSelector('.pref-app-icon .app-icon-option', { timeout: 15000 })
  return settings
}

const storedAppIcon = (app: ElectronApplication): Promise<unknown> =>
  app.evaluate(({ app: electronApp }) => {
    const fs = process.getBuiltinModule('fs')
    const path = process.getBuiltinModule('path')
    const file = path.join(electronApp.getPath('userData'), 'preferences.json')
    return JSON.parse(fs.readFileSync(file, 'utf8')).appIcon
  })

const aboutLogo = async(app: ElectronApplication, page: Page): Promise<string> => {
  await app.evaluate(({ BrowserWindow }) => {
    // The Preferences window loads the same page, under a #/preference route.
    BrowserWindow.getAllWindows()
      .find((win) => !win.webContents.getURL().includes('#/preference'))
      ?.webContents.send('mt::about-dialog')
  })
  const logo = page.locator('.about-dialog img.logo')
  await logo.waitFor({ state: 'visible', timeout: 15000 })
  return (await logo.getAttribute('src')) ?? ''
}

test.describe('App icon', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# App icon\n')
    app = launched.app
    page = launched.page
    await page.waitForSelector('.mu-container', { timeout: 15000 })
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('offers each colour, with Google Blue chosen by default', async() => {
    const settings = await openThemePreferences(app)
    const options = settings.locator('.app-icon-option')
    await expect(options).toHaveCount(2)
    await expect(options.locator('.app-icon-name')).toHaveText(['Google Blue', 'Nokia Light Blue'])
    await expect(options.nth(0)).toHaveAttribute('aria-checked', 'true')
    await expect(options.nth(1)).toHaveAttribute('aria-checked', 'false')
    // Both previews of each option load.
    for (const img of await settings.locator('.app-icon-option img').all()) {
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
    }
  })

  test('choosing a colour stores it and reaches open editor windows', async() => {
    const settings = await openThemePreferences(app)
    // Each option's first image is its app icon; small SVGs are inlined, so
    // compare sources rather than look for a file name.
    const [googleBlue, nokiaLightBlue] = await settings
      .locator('.app-icon-option img:first-child')
      .evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')))
    expect(googleBlue).not.toBe(nokiaLightBlue)
    expect(await aboutLogo(app, page)).toBe(googleBlue)
    await page.keyboard.press('Escape')

    await settings.locator('.app-icon-option', { hasText: 'Nokia Light Blue' }).click()
    await expect(settings.locator('.app-icon-option').nth(1)).toHaveAttribute('aria-checked', 'true')

    await expect.poll(() => storedAppIcon(app)).toBe('nokia-light-blue')
    await expect.poll(() => aboutLogo(app, page)).toBe(nokiaLightBlue)
  })
})
