import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { app, BrowserWindow, nativeImage, shell } from 'electron'
import log from 'electron-log'
import { isSamePathSync } from 'common/filesystem/paths'
import { APP_PRODUCT_NAME, WINDOWS_MARKDOWN_PROGIDS } from 'common/appIdentity'
import {
  DEFAULT_APP_ICON,
  appIconFileName,
  isAppIconId,
  macDockIconFileName,
  markdownIconFileName,
  type AppIconId
} from 'common/appIcon'
import type { IUserPreferences } from '@shared/types/preferences'
import { isOsx, isWindows } from '../config'
import { onInternalChannel } from '../utils/internalIpc'
import type Preference from '../preferences'

const execFileAsync = promisify(execFile)

export const resolveAppIcon = (value: unknown): AppIconId =>
  isAppIconId(value) ? value : DEFAULT_APP_ICON

const iconsDir = (): string =>
  path.join((global as unknown as { __static: string }).__static, 'icons')

const SHORTCUT_NAME = `${APP_PRODUCT_NAME}.lnk`

/**
 * Shortcuts in the user's own profile: the installer's for a per-user install,
 * and the one Windows makes when the app is pinned to the taskbar.
 */
const userShortcuts = (): string[] => {
  const roaming = app.getPath('appData')
  return [
    path.join(app.getPath('desktop'), SHORTCUT_NAME),
    path.join(roaming, 'Microsoft', 'Windows', 'Start Menu', 'Programs', SHORTCUT_NAME),
    path.join(roaming, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar', SHORTCUT_NAME)
  ]
}

/** The installer's shortcuts for an install for all users; only an administrator may change them. */
const allUsersShortcuts = (): string[] => [
  path.join(process.env.PUBLIC ?? 'C:\\Users\\Public', 'Desktop', SHORTCUT_NAME),
  path.join(process.env.ProgramData ?? 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs', SHORTCUT_NAME)
]

const powershellPath = (): string =>
  path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

/** A PowerShell string literal. */
const psLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`

/**
 * Sets the icon of shortcuts the user may not write to, from an elevated
 * PowerShell. WScript.Shell rewrites a shortcut with every other property
 * intact, the AppUserModelID that groups the app's taskbar button included.
 * Encoded, the script reaches the elevated process whatever its paths contain.
 */
const elevatedShortcutCommand = (shortcuts: string[], icon: string): string => {
  const script =
    '$shell = New-Object -ComObject WScript.Shell; ' +
    `foreach ($path in @(${shortcuts.map(psLiteral).join(', ')})) { ` +
    `$link = $shell.CreateShortcut($path); $link.IconLocation = ${psLiteral(`${icon},0`)}; $link.Save() }`
  return Buffer.from(script, 'utf16le').toString('base64')
}

/**
 * Points each Markdown ProgId that opens with this executable at the icon in
 * MT_FILE_ICON, updates the shortcuts in MT_ELEVATED (after a UAC prompt) if
 * given, and, when anything changed, tells Explorer to redraw file icons.
 *
 * The icon goes under HKCU whichever hive holds the ProgId: a key there
 * overrides the same key in HKLM, so an install for all users gets the user's
 * own colour without administrator rights, while its open command still comes
 * from HKLM. The owner check reads the merged view, so a second copy of the
 * app (an unpacked build, say) leaves the installed copy's registration alone.
 *
 * Paths arrive through the environment rather than the command line so no
 * quoting or console code page can mangle them, and the script contains no
 * double quotes, which Node would escape for the command line.
 */
const SHELL_ICON_SCRIPT = [
  '$exe = $env:MT_EXE.ToLowerInvariant();',
  '$icon = $env:MT_FILE_ICON;',
  "$changed = $env:MT_SHORTCUTS_CHANGED -eq '1';",
  "$userClasses = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\\Classes', $true);",
  "foreach ($id in $env:MT_PROGIDS.Split(';')) {",
  "  $command = [Microsoft.Win32.Registry]::ClassesRoot.OpenSubKey($id + '\\shell\\open\\command');",
  '  if ($command -eq $null) { continue };',
  "  $value = [string]$command.GetValue('');",
  '  $command.Close();',
  '  if (-not $value.ToLowerInvariant().Contains($exe)) { continue };',
  "  $key = $userClasses.CreateSubKey($id + '\\DefaultIcon');",
  "  if ([string]$key.GetValue('', '', 'DoNotExpandEnvironmentNames') -ne $icon) {",
  "    $key.SetValue('', $icon, 'ExpandString'); $changed = $true",
  '  };',
  '  $key.Close()',
  '};',
  'if ($env:MT_ELEVATED) {',
  // Throws when the user declines the UAC prompt; the rest still applies.
  "  try { Start-Process -FilePath (Get-Process -Id $PID).Path -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-NoProfile', '-NonInteractive', '-EncodedCommand', $env:MT_ELEVATED; $changed = $true }",
  "  catch { Write-Output 'elevation declined' }",
  '};',
  'if ($changed) {',
  // C# needs the double quotes the script must not contain.
  '  $q = [char]34;',
  "  Add-Type -Namespace JoshuaMarkText -Name Shell -MemberDefinition ('[DllImport(' + $q + 'shell32.dll' + $q + ')] public static extern void SHChangeNotify(int eventId, uint flags, IntPtr item1, IntPtr item2);');",
  // SHCNE_ASSOCCHANGED: file type registrations changed; redraw every icon.
  '  [JoshuaMarkText.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)',
  '}'
].join(' ')

interface ShellIconRecord {
  icon: AppIconId
  exe: string
  // Changes whenever the installer writes the executable again. A reinstall
  // also recreates the shortcuts and file type keys in the default colour; an
  // update keeps the shortcuts.
  exeModified: number
}

type ShortcutUpdate = 'unchanged' | 'changed' | 'failed'

/**
 * Applies the "App icon" preference: the icon of every window, the macOS
 * Dock icon and, in an installed Windows copy, the shortcuts and the icon
 * Explorer shows for Markdown files. The executable's own icon is compiled in
 * and stays the default colour.
 */
class AppIcon {
  private _preferences: Preference
  // Shell updates run one after another; a later choice must not finish first.
  private _shellQueue: Promise<void> = Promise.resolve()

  constructor(preferences: Preference) {
    this._preferences = preferences
  }

  get current(): AppIconId {
    return resolveAppIcon(this._preferences.getItem('appIcon'))
  }

  /**
   * For `BrowserWindow`'s `icon` option. macOS ignores it and takes the
   * Dock's icon instead.
   */
  windowIconPath(): string | undefined {
    if (isOsx) return undefined
    return path.join(iconsDir(), appIconFileName(this.current, isWindows ? 'ico' : 'png'))
  }

  /** Call once the app is ready. */
  start(): void {
    onInternalChannel('broadcast-preferences-changed', (change: Partial<IUserPreferences>) => {
      if (change.appIcon !== undefined) this._apply(resolveAppIcon(change.appIcon))
    })
    const icon = this.current
    // The bundle already carries the default.
    if (isOsx && icon !== DEFAULT_APP_ICON) this._setDockIcon(icon)
    this._queueShellUpdate(icon, false)
  }

  private _apply(icon: AppIconId): void {
    const iconPath = this.windowIconPath()
    if (iconPath) {
      for (const win of BrowserWindow.getAllWindows()) {
        win.setIcon(iconPath)
      }
    }
    if (isOsx) this._setDockIcon(icon)
    this._queueShellUpdate(icon, true)
  }

  private _setDockIcon(icon: AppIconId): void {
    const image = nativeImage.createFromPath(path.join(iconsDir(), macDockIconFileName(icon)))
    if (!image.isEmpty()) app.dock?.setIcon(image)
  }

  private _queueShellUpdate(icon: AppIconId, chosenNow: boolean): void {
    // A development run's executable is Electron itself, and the registry
    // entries, if any, belong to an installed copy.
    if (!isWindows || !app.isPackaged) return
    this._shellQueue = this._shellQueue
      .then(() => this._updateWindowsShell(icon, chosenNow))
      .catch((error: unknown) => log.error('Failed to update the shell icons:', error))
  }

  /**
   * `chosenNow` is true right after the user picks an icon, and only then may
   * Windows ask for administrator rights. On startup this only acts when the
   * icon differs from what was last applied for this executable, so Explorer
   * is not made to redraw its icons on every launch.
   */
  private async _updateWindowsShell(icon: AppIconId, chosenNow: boolean): Promise<void> {
    const recordPath = path.join(app.getPath('userData'), 'shell-icon.json')
    const exe = process.execPath
    const record: ShellIconRecord = { icon, exe, exeModified: fs.statSync(exe).mtimeMs }
    if (!chosenNow) {
      const last = readRecord(recordPath)
      if (last) {
        if (
          last.icon === record.icon &&
          last.exe === record.exe &&
          last.exeModified === record.exeModified
        ) {
          return
        }
      } else if (icon === DEFAULT_APP_ICON) {
        // First run after a fresh install: the installer has just put the
        // default colour everywhere.
        writeRecord(recordPath, record)
        return
      }
    }

    // The installer points shortcuts at the executable's built-in icon.
    const shortcutIcon =
      icon === DEFAULT_APP_ICON ? exe : path.join(iconsDir(), appIconFileName(icon, 'ico'))
    let shortcutsChanged = false
    const needAdministrator: string[] = []
    for (const shortcut of userShortcuts()) {
      if (updateShortcutIcon(shortcut, exe, shortcutIcon) === 'changed') shortcutsChanged = true
    }
    for (const shortcut of allUsersShortcuts()) {
      const result = updateShortcutIcon(shortcut, exe, shortcutIcon)
      if (result === 'changed') shortcutsChanged = true
      else if (result === 'failed') needAdministrator.push(shortcut)
    }
    if (needAdministrator.length && !chosenNow) {
      log.info('Shortcuts for all users keep their icon until the app icon is chosen again.')
    }

    const { stdout } = await execFileAsync(
      powershellPath(),
      ['-NoProfile', '-NonInteractive', '-Command', SHELL_ICON_SCRIPT],
      {
        env: {
          ...process.env,
          MT_EXE: exe,
          MT_FILE_ICON: `${path.join(iconsDir(), markdownIconFileName(icon, 'ico'))},0`,
          MT_PROGIDS: WINDOWS_MARKDOWN_PROGIDS.join(';'),
          MT_SHORTCUTS_CHANGED: shortcutsChanged ? '1' : '0',
          MT_ELEVATED:
            chosenNow && needAdministrator.length
              ? elevatedShortcutCommand(needAdministrator, shortcutIcon)
              : ''
        },
        windowsHide: true,
        // Includes the time the UAC prompt waits for an answer.
        timeout: 5 * 60_000
      }
    )
    if (stdout.trim()) log.info(`Shell icon update: ${stdout.trim()}`)
    writeRecord(recordPath, record)
    log.info(`Shell icons set to ${icon}.`)
  }
}

/** Leaves alone shortcuts that do not start this executable. */
const updateShortcutIcon = (shortcut: string, exe: string, icon: string): ShortcutUpdate => {
  if (!fs.existsSync(shortcut)) return 'unchanged'
  try {
    const details = shell.readShortcutLink(shortcut)
    if (!isSamePathSync(details.target, exe)) return 'unchanged'
    if (details.icon && isSamePathSync(details.icon, icon) && !details.iconIndex) return 'unchanged'
    // `update` keeps every property not given here, the AppUserModelID included.
    return shell.writeShortcutLink(shortcut, 'update', { target: details.target, icon, iconIndex: 0 })
      ? 'changed'
      : 'failed'
  } catch (error) {
    log.warn(`Could not update the icon of ${shortcut}:`, error)
    return 'failed'
  }
}

const readRecord = (recordPath: string): ShellIconRecord | null => {
  try {
    return JSON.parse(fs.readFileSync(recordPath, 'utf8')) as ShellIconRecord
  } catch {
    return null
  }
}

const writeRecord = (recordPath: string, record: ShellIconRecord): void => {
  try {
    fs.writeFileSync(recordPath, JSON.stringify(record), 'utf8')
  } catch (error) {
    log.warn('Could not record the applied shell icon:', error)
  }
}

export default AppIcon
