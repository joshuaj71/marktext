import path from 'path'
import { app } from 'electron'
import { APP_SLUG } from 'common/appIdentity'
import EnvPaths from 'common/envPaths'
import { ensureDirSync } from 'common/filesystem'

class AppPaths extends EnvPaths {
  /**
   * Configure and sets all application paths.
   *
   * @param userDataPath The user data path or empty string for default.
   */
  constructor(userDataPath: string = '') {
    if (!userDataPath) {
      // Named explicitly rather than taken from Electron's default, which is
      // derived from the package name and would be upstream MarkText's folder
      // in an unpackaged run.
      userDataPath = path.join(app.getPath('appData'), APP_SLUG)
    }

    // Initialize environment paths
    super(userDataPath)

    // Changing the user data directory is only allowed during application bootstrap.
    app.setPath('userData', this.electronUserDataPath)
  }
}

export const ensureAppDirectoriesSync = (paths: AppPaths): void => {
  ensureDirSync(paths.userDataPath)
  ensureDirSync(paths.logPath)
  // TODO(sessions): enable this...
  // ensureDirSync(paths.electronUserDataPath)
  // ensureDirSync(paths.globalStorage)
  // ensureDirSync(paths.preferencesPath)
  // ensureDirSync(paths.sessionsPath)
}

export default AppPaths
