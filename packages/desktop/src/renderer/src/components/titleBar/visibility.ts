export function shouldShowInAppTitleBar(titleBarStyle: string, isOsx: boolean): boolean {
  return titleBarStyle !== 'native' || isOsx
}

/**
 * Whether the tab strip is laid out inside the title bar's row instead of in a
 * second row below it. That takes all three: an in-app title bar to share, the
 * tab bar switched on, and an open file — without one the tab strip is not
 * rendered and the row shows the plain window title.
 */
export function tabsShareTitleBarRow(
  showTitleBar: boolean,
  showTabBar: boolean,
  hasOpenFile: boolean
): boolean {
  return showTitleBar && showTabBar && hasOpenFile
}
