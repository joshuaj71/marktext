import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// The accent colour is chosen in the Preferences window but has to recolour
// every editor window, live, on top of whichever theme is active.

const GOOGLE_BLUE = 'rgba(66, 133, 244, 1)'

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
  await settings.waitForSelector('.pref-accent .accent-swatch', { timeout: 15000 })
  return settings
}

const themeColor = (page: Page): Promise<string> =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--themeColor').trim()
  )

const linkColor = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--linkColor)'
    document.body.appendChild(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  })

test.describe('Accent colour', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    // Theme cards are locked while the app follows the system theme.
    const launched = await launchWithMarkdown('# Accent\n\nA [link](https://example.com).\n', {
      preferences: { theme: 'light', followSystemTheme: false }
    })
    app = launched.app
    page = launched.page
    await page.waitForSelector('.mu-container', { timeout: 15000 })
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('a preset recolours the editor window and can be reset', async() => {
    const themeDefault = await themeColor(page)
    const settings = await openThemePreferences(app)

    await expect(settings.locator('.pref-accent .accent-swatch')).toHaveCount(13)
    await expect(settings.locator('.accent-swatch.theme-default')).toHaveClass(/active/)

    await settings.locator('.accent-swatch[title="Google Blue"]').click()
    await expect.poll(() => themeColor(page)).toBe(GOOGLE_BLUE)
    expect(await themeColor(settings)).toBe(GOOGLE_BLUE)
    expect(await linkColor(page)).toBe('rgb(66, 133, 244)')
    await expect(settings.locator('.accent-swatch[title="Google Blue"]')).toHaveClass(/active/)
    await expect(settings.locator('.accent-value')).toHaveText('#4285F4')

    await settings.locator('.accent-swatch.theme-default').click()
    await expect.poll(() => themeColor(page)).toBe(themeDefault)
    expect(await page.evaluate(() => document.getElementById('ag-accent'))).toBeNull()
  })

  test('the accent survives a theme change', async() => {
    const settings = await openThemePreferences(app)
    await settings.locator('.accent-swatch[title="Google Blue"]').click()
    await expect.poll(() => themeColor(page)).toBe(GOOGLE_BLUE)

    await settings.locator('.offcial-themes .theme.dark').click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--editorBgColor').trim()
        )
      )
      .toBe('#282828')
    expect(await themeColor(page)).toBe(GOOGLE_BLUE)
    // The dark theme hard-codes its link colour to its own accent; the custom
    // accent has to take that over too.
    expect(await linkColor(page)).toBe('rgb(66, 133, 244)')
  })

  test('dragging the hue slider changes the hue and keeps the tone', async() => {
    const settings = await openThemePreferences(app)
    await settings.locator('.accent-swatch[title="Google Blue"]').click()
    await expect.poll(() => themeColor(page)).toBe(GOOGLE_BLUE)

    const slider = settings.locator('.accent-hue')
    const box = await slider.boundingBox()
    if (!box) throw new Error('hue slider is not laid out')
    const y = box.y + box.height / 2
    await settings.mouse.move(box.x + box.width * 0.6, y)
    await settings.mouse.down()
    await settings.mouse.move(box.x + box.width * 0.2, y, { steps: 8 })
    await settings.mouse.up()

    await expect.poll(() => themeColor(page)).not.toBe(GOOGLE_BLUE)
    const hue = Number(await slider.inputValue())
    expect(hue).toBeGreaterThan(40)
    expect(hue).toBeLessThan(110)
    expect(await themeColor(page)).toBe(await themeColor(settings))
  })
})
