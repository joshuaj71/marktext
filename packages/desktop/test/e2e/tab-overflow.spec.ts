import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// More tabs than the strip can show: the hidden end fades out and an "all
// tabs" button lists every tab in a native menu. Playwright cannot click a
// native menu, so the tests read the template the renderer sends and answer
// with the click the main process would send back.

interface MenuItem {
  id: string
  label: string
  checked: boolean
}

const captureMenus = (app: ElectronApplication): Promise<void> =>
  app.evaluate(({ ipcMain }) => {
    const g = global as unknown as { __menus__?: unknown[] }
    g.__menus__ = []
    ipcMain.on('mt::menu::popup', (_event, template) => {
      g.__menus__!.push(template)
    })
  })

const lastMenu = (app: ElectronApplication): Promise<MenuItem[] | undefined> =>
  app.evaluate(() => {
    const menus = (global as unknown as { __menus__?: unknown[] }).__menus__ ?? []
    return menus[menus.length - 1] as MenuItem[] | undefined
  })

const clickMenuItem = (app: ElectronApplication, id: string): Promise<void> =>
  app.evaluate(({ BrowserWindow }, itemId) => {
    const win = BrowserWindow.getAllWindows()[0]!
    win.webContents.send('mt::menu::click', { windowId: win.id, id: itemId })
    win.webContents.send('mt::menu::closed')
  }, id)

const openUntitledTabs = async(page: Page, count: number): Promise<void> => {
  for (let i = 0; i < count; i++) {
    await page.locator('.editor-tabs > .new-file').click()
  }
}

test.describe('Tab overflow', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# First\n', {
      preferences: { tabBarVisibility: true }
    })
    app = launched.app
    page = launched.page
    await page.waitForSelector('.tabs-container > li')
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]!.setSize(900, 600)
    })
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('a strip that fits shows no overflow button', async() => {
    await openUntitledTabs(page, 1)
    await expect(page.locator('.editor-tabs > .all-tabs')).toHaveCount(0)
    await expect(page.locator('.scrollable-tabs')).not.toHaveClass(/clipped-/)
  })

  test('hidden tabs fade the strip and are listed in the all-tabs menu', async() => {
    await openUntitledTabs(page, 14)
    const strip = page.locator('.scrollable-tabs')
    // The newest tab is active and scrolled into view, so the first ones are cut off.
    await expect(strip).toHaveClass(/clipped-start/)
    await expect(page.locator('.editor-tabs > .all-tabs')).toBeVisible()

    await captureMenus(app)
    await page.locator('.editor-tabs > .all-tabs').click()
    await expect.poll(async() => (await lastMenu(app))?.length).toBe(15)
    const menu = (await lastMenu(app))!
    expect(menu[0]!.label).toBe('note.md')
    expect(menu.filter((item) => item.checked)).toHaveLength(1)
    expect(menu[14]!.checked).toBe(true)

    await clickMenuItem(app, menu[0]!.id)
    await expect(page.locator('.tabs-container > li').first()).toHaveClass(/active/)
    // Selecting the first tab scrolls it into view, which hides the last ones.
    await expect(strip).toHaveClass(/clipped-end/)
    await expect(strip).not.toHaveClass(/clipped-start/)
  })

  test('widening the window until the tabs fit removes the button', async() => {
    await openUntitledTabs(page, 14)
    await expect(page.locator('.editor-tabs > .all-tabs')).toBeVisible()
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]!.setSize(2400, 600)
    })
    await expect(page.locator('.editor-tabs > .all-tabs')).toHaveCount(0)
  })
})
