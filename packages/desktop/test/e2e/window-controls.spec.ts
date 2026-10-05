import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// With the custom title bar, Windows gets the system's own caption buttons
// (Electron's window controls overlay, which offers Windows 11's snap layouts)
// instead of buttons drawn by the page, and the renderer keeps them in the
// theme's colours. Linux keeps the page-drawn buttons.

const overlayColors = (app: ElectronApplication): Promise<unknown[]> =>
  app.evaluate(() => (global as unknown as { __overlayColors__?: unknown[] }).__overlayColors__ ?? [])

test.describe('Window controls', () => {
  test.skip(process.platform === 'darwin', 'macOS keeps its traffic lights')

  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# Window controls\n', {
      preferences: { theme: 'light', followSystemTheme: false, titleBarStyle: 'custom' }
    })
    app = launched.app
    page = launched.page
    await page.waitForSelector('.mu-container', { timeout: 15000 })
    await app.evaluate(({ ipcMain }) => {
      const g = global as unknown as { __overlayColors__?: unknown[] }
      g.__overlayColors__ = []
      ipcMain.on('mt::win::set-title-bar-overlay', (_event, colors) => {
        g.__overlayColors__!.push(colors)
      })
    })
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('the page draws window buttons only where the system does not', async() => {
    await expect(page.locator('.frameless-titlebar-button')).toHaveCount(
      process.platform === 'win32' ? 0 : 3
    )
    // The menu button stays either way.
    await expect(page.locator('.frameless-titlebar-menu')).toHaveCount(1)
  })

  test('the native buttons follow the theme', async() => {
    test.skip(process.platform !== 'win32', 'Only Windows uses the native buttons')
    await app.evaluate(({ ipcMain }) => {
      ipcMain.emit('set-user-preference', { theme: 'dark' })
    })
    await expect
      .poll(() => overlayColors(app))
      .toContainEqual({ color: '#282828', symbolColor: expect.stringMatching(/^#[0-9a-f]{6}$/) })
  })
})
