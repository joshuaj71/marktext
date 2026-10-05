import {
  DEFAULT_APP_ICON,
  appIconFileName,
  isAppIconId,
  markdownIconFileName,
  type AppIconId
} from 'common/appIcon'

// Written by scripts/generate-icons.ts, one pair per variant.
const ICON_URLS = import.meta.glob<string>('../assets/images/appIcons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default'
})

const iconUrl = (fileName: string): string => ICON_URLS[`../assets/images/appIcons/${fileName}`] ?? ''

/** The variant a stored preference names, or the default for anything else. */
export const resolveAppIcon = (value: unknown): AppIconId =>
  isAppIconId(value) ? value : DEFAULT_APP_ICON

export const appIconUrl = (id: AppIconId): string => iconUrl(appIconFileName(id, 'svg'))

export const markdownIconUrl = (id: AppIconId): string => iconUrl(markdownIconFileName(id, 'svg'))
