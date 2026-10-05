import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { APP_PRODUCT_NAME } from '../../src/common/appIdentity'
import { launchElectron } from './helpers'

test.describe('Check Launch MarkText', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const { app: electronApp, page: firstPage } = await launchElectron()
    app = electronApp
    page = firstPage
  })

  test.afterAll(async() => {
    await app.close()
  })

  test('Empty MarkText', async() => {
    const title = await page.title()
    expect([APP_PRODUCT_NAME, `Untitled-1 - ${APP_PRODUCT_NAME}`]).toContain(title)
  })
})
