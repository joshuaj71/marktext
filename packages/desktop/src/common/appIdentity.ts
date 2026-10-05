/**
 * What makes this build its own application rather than a copy of upstream
 * MarkText: the name people see, and the identifiers the operating system uses
 * to keep its settings, credentials, shortcuts and updates apart.
 *
 * The packaging side cannot import this module, so the same values are written
 * out in `electron-builder.yml` and `build/windows/installer.nsh`;
 * `test/unit/specs/app-identity.spec.ts` fails when they drift apart.
 */

/** Display name: window title, About dialog, shortcuts, installer. */
export const APP_PRODUCT_NAME = 'Joshua MarkText'

/**
 * Reverse-DNS application ID. On Windows it is also the AppUserModelID that
 * ties a running window to its taskbar and Start menu shortcut, so it has to
 * equal `appId` in `electron-builder.yml`.
 */
export const APP_ID = 'com.github.joshuaj71.marktext'

/**
 * Machine-facing name, safe for file systems and package managers: the
 * settings folder inside the OS application-data directory, the executable,
 * and the service under which credentials are stored in the OS keychain.
 */
export const APP_SLUG = 'joshua-marktext'

/** Where this build's source, releases and issue tracker live. */
export const APP_REPO_URL = 'https://github.com/joshuaj71/marktext'

/** The project this build is derived from; credited in the About dialog. */
export const UPSTREAM_PRODUCT_NAME = 'MarkText'
export const UPSTREAM_REPO_URL = 'https://github.com/marktext/marktext'
