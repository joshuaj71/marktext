import { isWindows } from '@/util'
import { resolveColor, rgbStringToHex } from '@/util/accentColor'

/**
 * Paints the native window controls Windows draws over the in-app title bar
 * in the active theme's background and text colours. Call after every change
 * of theme or custom CSS; elsewhere, and in windows without those controls,
 * it does nothing.
 */
export const syncTitleBarOverlay = (): void => {
  if (!isWindows) return
  const color = rgbStringToHex(resolveColor('var(--editorBgColor)'))
  const symbolColor = rgbStringToHex(resolveColor('var(--editorColor)'))
  if (color && symbolColor) {
    window.electron.windowControl.setTitleBarOverlay({ color, symbolColor })
  }
}
