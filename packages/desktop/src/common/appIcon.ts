/**
 * Colour variants of the application icon and the Markdown file icon. The user
 * picks one under Preferences > Theme; `scripts/generate-icons.ts` draws every
 * variant from `color`, and the app switches between the files it writes to
 * `static/icons/`.
 */

export interface AppIconVariant {
  id: string
  /** A proper name, shown as written in every locale. */
  name: string
  /** `#rrggbb`: the tile's mid tone, which the generator shades into a gradient. */
  color: string
}

/**
 * A new variant also goes into the `appIcon` enum of
 * src/main/preferences/schema.json; then run `pnpm run generate-icons`.
 */
export const APP_ICON_VARIANTS = [
  { id: 'google-blue', name: 'Google Blue', color: '#4285f4' },
  { id: 'nokia-light-blue', name: 'Nokia Light Blue', color: '#00c9ff' }
] as const satisfies readonly AppIconVariant[]

export type AppIconId = (typeof APP_ICON_VARIANTS)[number]['id']

/**
 * The variant built into the executable, the installer and the macOS bundle,
 * which a fresh install shows before any preference is read.
 */
export const DEFAULT_APP_ICON: AppIconId = 'google-blue'

export const isAppIconId = (value: unknown): value is AppIconId =>
  APP_ICON_VARIANTS.some(({ id }) => id === value)

/** File names inside `static/icons/`. */
export const appIconFileName = (id: AppIconId, ext: 'ico' | 'png' | 'svg'): string =>
  `app-${id}.${ext}`
/** Drawn on Apple's icon grid, whose tile is smaller than the other platforms'. */
export const macDockIconFileName = (id: AppIconId): string => `app-${id}-macos.png`
export const markdownIconFileName = (id: AppIconId, ext: 'ico' | 'svg'): string =>
  `md-${id}.${ext}`
