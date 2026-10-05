import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  APP_ID,
  APP_PRODUCT_NAME,
  APP_REPO_URL,
  APP_SLUG,
  UPSTREAM_PRODUCT_NAME,
  UPSTREAM_REPO_URL,
  WINDOWS_MARKDOWN_PROGIDS
} from 'common/appIdentity'

// The app's identity is written down three times: in appIdentity.ts for the
// running app, in electron-builder.yml for the packager and in installer.nsh
// for the Windows installer, because neither of the latter can import
// TypeScript. A mismatch does not fail a build; it produces an app whose
// taskbar shortcut, settings folder or uninstaller belongs to something else —
// at worst to upstream MarkText installed next to it.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(__dirname, '../../..')
const read = (relativePath: string): string =>
  readFileSync(path.join(desktopRoot, relativePath), 'utf8')

const builderConfig = read('electron-builder.yml')
const installerScript = read('build/windows/installer.nsh')

// Value of a `key: value` line; `indent` is the key's leading whitespace.
const yamlValue = (key: string, indent = ''): string | undefined => {
  const match = builderConfig.match(
    new RegExp(`^${indent}${key}:\\s*['"]?([^'"\\n#]+?)['"]?\\s*$`, 'm')
  )
  return match?.[1]
}

// The lines nested under a top-level `key:`.
const yamlBlock = (key: string): string => {
  const match = builderConfig.match(new RegExp(`^${key}:\\n((?:[ \\t]+.*\\n|\\n)+)`, 'm'))
  expect(match, `electron-builder.yml has no "${key}" block`).not.toBeNull()
  return match![1]!
}

const nsisDefine = (name: string): string | undefined =>
  installerScript.match(new RegExp(`^!define\\s+${name}\\s+"([^"]+)"`, 'm'))?.[1]

describe('app identity', () => {
  it('is distinct from upstream MarkText', () => {
    expect(APP_PRODUCT_NAME).not.toBe(UPSTREAM_PRODUCT_NAME)
    expect(APP_ID).not.toBe('com.github.marktext.marktext')
    expect(APP_SLUG).not.toBe('marktext')
    expect(APP_REPO_URL).not.toBe(UPSTREAM_REPO_URL)
  })

  it('uses a slug that is safe as a folder, executable and package name', () => {
    expect(APP_SLUG).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('packages under the same application ID and product name', () => {
    expect(yamlValue('appId')).toBe(APP_ID)
    expect(yamlValue('productName')).toBe(APP_PRODUCT_NAME)
  })

  it('renames the packaged app and its executables to the slug', () => {
    expect(yamlBlock('extraMetadata')).toMatch(new RegExp(`^\\s+name:\\s*${APP_SLUG}\\s*$`, 'm'))
    expect(yamlBlock('win')).toMatch(new RegExp(`^\\s+executableName:\\s*${APP_SLUG}\\s*$`, 'm'))
    expect(yamlBlock('linux')).toMatch(
      new RegExp(`^\\s+executableName:\\s*'${APP_SLUG}'\\s*$`, 'm')
    )
    expect(yamlBlock('linux')).toMatch(new RegExp(`StartupWMClass:\\s*'${APP_SLUG}'`))
  })

  it('names every artifact after the slug', () => {
    const artifactNames = [...builderConfig.matchAll(/artifactName:\s*'([^']+)'/g)].map(
      (m) => m[1]!
    )
    expect(artifactNames.length).toBeGreaterThan(0)
    for (const name of artifactNames) {
      expect(name.startsWith(`${APP_SLUG}-`), `"${name}" is not named after the app`).toBe(true)
    }
  })

  it('publishes to, and updates from, its own repository', () => {
    const publish = yamlBlock('publish')
    const owner = publish.match(/^\s+owner:\s*(\S+)/m)?.[1]
    const repo = publish.match(/^\s+repo:\s*(\S+)/m)?.[1]
    expect(publish).toMatch(/^\s+provider:\s*github\s*$/m)
    expect(`https://github.com/${owner}/${repo}`).toBe(APP_REPO_URL)
  })

  it('registers Windows file types under ProgIds of its own', () => {
    const builderProgIds = new Set(
      [...yamlBlock('fileAssociations').matchAll(/^\s+name:\s*(\S+)\s*$/gm)].map((m) => m[1])
    )
    expect([...builderProgIds]).toEqual([nsisDefine('MT_BUILDER_PROGID')])
    // The app repoints these at the icon colour picked in Preferences.
    expect([nsisDefine('MT_PROGID'), nsisDefine('MT_BUILDER_PROGID')]).toEqual([
      ...WINDOWS_MARKDOWN_PROGIDS
    ])
    for (const progId of [nsisDefine('MT_PROGID'), nsisDefine('MT_BUILDER_PROGID')]) {
      expect(progId).toBeDefined()
      // Upstream's ProgIds; sharing one lets either uninstaller remove it.
      expect(['MarkText.Document', 'Markdown']).not.toContain(progId)
    }
  })

  it('offers to delete only its own settings folder on uninstall', () => {
    expect(nsisDefine('MT_SETTINGS_DIR')).toBe(APP_SLUG)
    const removals = installerScript.match(/RMDir[^\n]*/g) ?? []
    // `$` + `{` keeps the NSIS variable from reading as a JavaScript placeholder.
    expect(removals).toEqual(['RMDir /r "$APPDATA\\$' + '{MT_SETTINGS_DIR}"'])
  })

  it('does not hard-code an executable name in the installer script', () => {
    expect(installerScript).not.toMatch(/marktext\.exe/i)
  })

  it('titles the window with the product name', () => {
    expect(read('src/renderer/index.html')).toContain(`<title>${APP_PRODUCT_NAME}</title>`)
  })
})
