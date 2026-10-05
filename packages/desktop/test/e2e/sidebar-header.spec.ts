import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron } from './helpers'

// The folder header's actions (new file, new folder, collapse all), the
// option to hide Markdown extensions, and "Opened files" giving way to the
// tab bar.

const openProject = async(
  preferences: Record<string, unknown>
): Promise<{ app: ElectronApplication; page: Page; projectDir: string }> => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-sidebar-'))
  fs.writeFileSync(path.join(projectDir, 'note.md'), '# Note\n', 'utf-8')
  fs.writeFileSync(path.join(projectDir, 'plain.txt'), 'plain\n', 'utf-8')
  fs.mkdirSync(path.join(projectDir, 'docs', 'deep'), { recursive: true })
  fs.writeFileSync(path.join(projectDir, 'docs', 'guide.md'), '# Guide\n', 'utf-8')
  fs.writeFileSync(path.join(projectDir, 'docs', 'deep', 'more.md'), '# More\n', 'utf-8')

  const { app, page: first } = await launchElectron([projectDir], { preferences })
  let page = first
  // Opening a directory can attach to a window other than the first one.
  await expect
    .poll(
      async() => {
        for (const candidate of app.windows()) {
          if (await candidate.locator('.side-bar-file').count()) {
            page = candidate
            return true
          }
        }
        return false
      },
      { timeout: 15000 }
    )
    .toBe(true)
  return { app, page, projectDir }
}

const fileNames = (page: Page): Promise<string[]> =>
  page.locator('.side-bar-file > span').allInnerTexts()

test.describe('Sidebar folder header', () => {
  let app: ElectronApplication
  let page: Page
  let projectDir: string

  test.afterEach(async() => {
    if (app) await app.close()
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true })
  })

  test('collapse all folds every open folder', async() => {
    ;({ app, page, projectDir } = await openProject({}))
    await page.locator('.folder-name', { hasText: 'docs' }).click()
    await page.locator('.folder-name', { hasText: 'deep' }).click()
    await expect(page.locator('.side-bar-file', { hasText: 'more.md' })).toBeVisible()

    await page.locator('.project-tree > .title').hover()
    await page.locator('.title-action[aria-label="Collapse All Folders"]').click()
    await expect(page.locator('.folder-name', { hasText: 'deep' })).toHaveCount(0)
    await expect(page.locator('.side-bar-file', { hasText: 'guide.md' })).toHaveCount(0)
    // Reopening docs shows deep folded too.
    await page.locator('.folder-name', { hasText: 'docs' }).click()
    await expect(page.locator('.folder-name', { hasText: 'deep' })).toBeVisible()
    await expect(page.locator('.side-bar-file', { hasText: 'more.md' })).toHaveCount(0)
  })

  test('new file and new folder create at the root', async() => {
    ;({ app, page, projectDir } = await openProject({}))
    await page.locator('.project-tree > .title').hover()
    await page.locator('.title-action[aria-label="New File"]').click()
    const input = page.locator('.project-tree > .tree-wrapper > input.new-input')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()
    await input.fill('fresh')
    await input.press('Enter')
    await expect.poll(() => fs.existsSync(path.join(projectDir, 'fresh.md'))).toBe(true)

    await page.locator('.project-tree > .title').hover()
    await page.locator('.title-action[aria-label="New Directory"]').click()
    await expect(input).toBeFocused()
    await input.fill('folder')
    await input.press('Enter')
    await expect
      .poll(() => fs.existsSync(path.join(projectDir, 'folder')) && fs.statSync(path.join(projectDir, 'folder')).isDirectory())
      .toBe(true)
  })

  test('Markdown extensions can be hidden, plain text keeps its own', async() => {
    ;({ app, page, projectDir } = await openProject({ hideMarkdownExtension: true }))
    await expect.poll(() => fileNames(page)).toEqual(expect.arrayContaining(['note', 'plain.txt']))
    expect(await fileNames(page)).not.toContain('note.md')
  })

  test('opened files give way to the tab bar', async() => {
    ;({ app, page, projectDir } = await openProject({ openedFilesInSidebar: true }))
    // What View > Show Tab Bar ends in, through the live layout store. (Opening
    // a folder always shows the tab bar.)
    const setTabBar = (visible: boolean): Promise<void> =>
      page.evaluate((show) => {
        const root = document.querySelector('#app') as Element & {
          __vue_app__?: { config?: { globalProperties?: Record<string, unknown> } }
        }
        const pinia = root.__vue_app__?.config?.globalProperties?.$pinia as {
          _s: Map<string, Record<string, unknown>>
        }
        pinia._s.get('layout')!.showTabBar = show
      }, visible)

    await expect(page.locator('.opened-files')).toHaveCount(0)
    await setTabBar(false)
    await expect(page.locator('.opened-files')).toBeVisible()
    await setTabBar(true)
    await expect(page.locator('.opened-files')).toHaveCount(0)
  })
})
