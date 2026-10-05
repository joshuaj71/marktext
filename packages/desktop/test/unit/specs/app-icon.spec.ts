import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  APP_ICON_VARIANTS,
  DEFAULT_APP_ICON,
  appIconFileName,
  isAppIconId,
  macDockIconFileName,
  markdownIconFileName
} from 'common/appIcon'

// The variants are listed in appIcon.ts, in the preference schema and in the
// default preferences, and each has files that scripts/generate-icons.ts
// writes. A variant missing from any of them is offered in Preferences but
// switches to a blank icon, or is rejected when saved.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(__dirname, '../../..')
const readJson = (relativePath: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(desktopRoot, relativePath), 'utf8'))

const ids = APP_ICON_VARIANTS.map(({ id }) => id)

describe('app icon variants', () => {
  it('match the preference schema and its default', () => {
    const schema = readJson('src/main/preferences/schema.json').appIcon as {
      enum: string[]
      default: string
    }
    expect(schema.enum).toEqual(ids)
    expect(schema.default).toBe(DEFAULT_APP_ICON)
    expect(readJson('static/preference.json').appIcon).toBe(DEFAULT_APP_ICON)
  })

  it('have ids that are safe in file names and colours the generator can parse', () => {
    for (const { id, color } of APP_ICON_VARIANTS) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(color).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each have every generated file', () => {
    for (const id of ids) {
      for (const file of [
        `static/icons/${appIconFileName(id, 'ico')}`,
        `static/icons/${appIconFileName(id, 'png')}`,
        `static/icons/${macDockIconFileName(id)}`,
        `static/icons/${markdownIconFileName(id, 'ico')}`,
        `src/renderer/src/assets/images/appIcons/${appIconFileName(id, 'svg')}`,
        `src/renderer/src/assets/images/appIcons/${markdownIconFileName(id, 'svg')}`
      ]) {
        expect(existsSync(path.join(desktopRoot, file)), `${file} is missing`).toBe(true)
      }
    }
  })

  it('recognises only the listed ids', () => {
    expect(isAppIconId(DEFAULT_APP_ICON)).toBe(true)
    expect(isAppIconId('')).toBe(false)
    expect(isAppIconId('marktext-green')).toBe(false)
    expect(isAppIconId(undefined)).toBe(false)
  })
})
