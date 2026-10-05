# Release notes

Release notes for this fork of [MarkText](https://github.com/marktext/marktext),
maintained at <https://github.com/joshuaj71/marktext>. For the history of
MarkText itself, see the upstream project's releases.

## v1.1.0 — 2026-10-05

The fork becomes an application of its own, **Joshua MarkText**, and gains what
it needs to be installed and updated independently of the official MarkText.
There are no changes to the editor or the interface in this release.

### A separate application

- **Name:** Joshua MarkText, in the About dialog, the installer, the Start
  menu or application launcher, and the title bar when no file is open.
- **Application ID:** `com.github.joshuaj71.marktext` (was upstream's
  `com.github.marktext.marktext`). The running app registers the same ID with
  Windows, so its window and its shortcut are one taskbar item.
- **Executable and packages:** `joshua-marktext` (was `marktext`), so the
  installer no longer mistakes a running official MarkText for a running copy
  of itself.
- **Settings folder:** `joshua-marktext` inside the system's application-data
  folder — `%APPDATA%\joshua-marktext` on Windows, `~/.config/joshua-marktext`
  on Linux, `~/Library/Application Support/joshua-marktext` on macOS.
  Development runs use `joshua-marktext-dev`.
- **Stored credentials** (for example image-uploader tokens) are kept under the
  app's own name in the system keychain.
- **File types on Windows** are registered under the app's own identifiers
  (`JoshuaMarkText.Document`, `JoshuaMarkText.Markdown`), so installing or
  removing this app leaves the official MarkText's registration alone, and the
  other way round.
- **Uninstalling on Windows** offers to delete only this app's settings folder.
  Before this release the uninstaller named the official MarkText's folder.
- **About dialog:** shows the new name and credits upstream with "Based on
  MarkText". The upstream copyright lines are unchanged.

### Updates and links

- An installed copy checks **this repository's releases** for updates, through
  Help → Check for Updates. That entry appears in the Windows installer build
  and the Linux AppImage, as before.
- Help → Changelog, Report Bug, View Source and License open this repository.
  Markdown Reference, Ask Question, Follow Us and Support MarkText still open
  the upstream project's pages.
- Report Bug opens this repository's issue tracker, which GitHub switches off
  for forks by default. Enable it under the repository's Settings → Features →
  Issues for the link to lead somewhere.

### Installers

- Installers and archives are named `joshua-marktext-<platform>-<arch>-<version>`.
- Building locally is unchanged: `pnpm run build:win` (or `build:mac`,
  `build:linux`) writes the installers to `dist/`.
- Publishing is unchanged: pushing a `v*` tag runs the release workflow, which
  builds for Windows, macOS and Linux and publishes a GitHub release with the
  installers and the files the update check reads. GitHub Actions has to be
  enabled on the fork for that to happen.

### Moving from v1.0.0 or the official MarkText

This release starts with default settings. It does not read, change or remove
the official MarkText's settings, and settings made while running v1.0.0 of
this fork stay where that version kept them, in the official MarkText's folder
(`marktext`, or `marktext-dev` for development runs).

To carry settings over by hand, close the app and copy `preferences.json` and
`keybindings.json` from the old folder into the new one.

### Verification

- A packaged Linux build was started with an empty profile: it runs without
  errors, reports itself as `joshua-marktext`, creates `~/.config/joshua-marktext`
  and no other folder, and its bundled update configuration points at this
  repository.
- New unit tests compare the identity used by the running app with the one in
  the packaging configuration and the Windows installer script, so the three
  cannot drift apart unnoticed.
- Automated tests, run on Linux: type checks pass, and 1,040 of 1,043 unit
  tests pass, with the same three environment-specific failures as in v1.0.0.
  In the full end-to-end run 330 tests passed and 4 were skipped; one test's
  app instance did not start because the test display server refused the
  connection, and that test passed when run again.

### Known limitations

- The Windows installer has not been built or run for this release. Its file
  type registration, side-by-side installation with the official MarkText and
  the update check are configured but untested.
- macOS is untested, as in v1.0.0.
- The application icon is still upstream's, so the two apps look alike in the
  Start menu apart from their names.
- Menus and a few messages still say "MarkText" where they name the app, for
  example "About MarkText".

## v1.0.0 — 2026-10-05

The first release of the fork: a redesigned interface, an adjustable accent
colour, and a Windows build that works with Visual Studio 2026.

Based on upstream `develop` at `0d8dba02` (version `0.21.0-dev`, five commits
after upstream `v0.20.0`). Everything upstream shipped up to that commit is
included unchanged, including the rewritten editor engine and its fixes for
undo/redo history.

### Highlights

- **One row of window chrome instead of two.** Tabs now sit inside the title
  bar. With the tab bar switched off, the title bar shows only the file name.
- **A sidebar that reads like a file explorer.** Clear indentation with guide
  lines, rounded row highlights and labelled sections.
- **Preferences grouped into cards**, with the label on the left and the
  control on the right.
- **Accent colour of your choice.** Twelve presets, a hue slider and a full
  colour picker, applied live to every open window and on top of any theme.
- **Builds with Visual Studio 2022 or 2026.** No Visual Studio version is
  pinned any more.

### Title bar and tabs

- The tab strip moves into the title bar's row whenever both are shown, on
  Windows, Linux and macOS. The centred file name is hidden in that mode,
  because the active tab already shows it; each tab's tooltip still gives the
  full path.
- Tabs are rounded pills. The active tab has a neutral background instead of a
  coloured underline, and the strip no longer casts a shadow over the document.
- The "new tab" button is always visible instead of appearing only on hover.
- With the tab bar hidden, the title shows the folder path in a muted tone and
  the file name in the normal text colour, separated by `/`.
- The word count moved from the top-left corner to the bottom-right corner of
  the window. Clicking it still cycles between words, paragraphs, characters
  and all characters.
- The menu button is a drawn icon with a hover state. Window buttons take
  their colour from the active theme.
- The title bar is 38 px tall (was 32 px).

### Sidebar

- Nested items are indented 14 px per level (was 6 px) and each open folder
  draws a guide line down the height of its contents.
- Rows are 28 px tall with rounded hover and selection highlights. The open
  file and the selected item use a neutral highlight instead of a green block
  and a green left bar.
- "Opened files" and the folder name are small upper-case section labels.
- Markdown files no longer show an icon, since nearly every row is one; other
  file types keep theirs, in a single muted tone. File names line up with
  folder names.
- The icon column on the left has rounded hover and active states.
- Search: the field has a visible focus ring, the option buttons have hover
  and active states, results are rows with a match-count pill.
- Table of contents: the heading is a section label like the others, and the
  current section's entry has a rounded highlight.
- The resize handle highlights in the accent colour on hover.

### Preferences

- Each group of settings is a bordered card; rows are separated by hairlines.
- Dropdowns, text fields and font pickers sit on the right of their label
  instead of underneath it, at a fixed 240 px width.
- Switches are filled: grey when off, accent colour when on.
- Sliders, dropdowns and text fields take their track and border colours from
  the active theme.
- The navigation list uses rounded highlights; the active page is shown with a
  neutral background rather than a green bar.
- Page titles are larger and group titles are small upper-case labels.
- The content column is capped at 680 px on wide windows.

### Accent colour

Preferences → Theme has a new **Accent Color** section.

- **Presets:** Google Blue `#4285F4`, Azure `#007FFF`, Nokia Blue `#124191`,
  Nokia Light Blue `#00C9FF`, Klein Blue `#002FA7`, Tiffany Blue `#0ABAB5`,
  MarkText Green `#21B56F`, Dusty Pink `#D48A9A`, Living Coral `#FF6F61`,
  Ferrari Red `#D40000`, Hermès Orange `#F37021` and Very Peri `#6667AB`.
- **Hue slider:** changes the hue and keeps the current saturation and
  lightness.
- **Colour picker:** for any other colour.
- **Theme default:** the first swatch removes the override and returns to the
  active theme's own accent.

The accent is applied on top of whichever theme is active and survives a theme
change. Colours that a theme ties to its accent follow the custom accent:
links, the blockquote border, checkboxes, search highlights, primary buttons,
and in the dark theme also list markers and emphasis. Colours to
which a theme gives a hue of its own are left alone. Text on primary buttons
switches to dark on light accents so it stays legible.

While a slider or the picker is being dragged, the Preferences window updates
immediately and open editor windows follow within about a tenth of a second.

The choice is stored in the new `accentColor` preference: a `#rrggbb` value,
or an empty string for the theme default. Custom CSS is loaded after the
accent, so it still has the last word.

### Look and feel

- The default accent of the light theme is a deeper green (`#17855B`, was
  `#21B56F`), which is easier to read as link text. The original green is
  available as the "MarkText Green" preset.
- Body text in the light theme is slightly darker (`#3B3B3B`, was `#4D4D4D`).
- Window chrome uses the system interface font (Segoe UI on Windows, the
  system font on macOS). The document font is unchanged and still set under
  Preferences → Editor.
- Scrollbars are thin rounded pills on a transparent track.
- Hover, selection and border tints are derived from each theme's text colour,
  so the bundled themes pick up the new look without per-theme changes.

### Fix

- The sidebar opened at its 220 px minimum on first launch instead of the
  intended 280 px, which cut off file names. A width that had never been saved
  was read as `0` and clamped.

### Building on Windows

- `.npmrc` no longer sets `msvs_version=2022`. node-gyp picks the newest
  installed Visual Studio that has the C++ build tools; 2019, 2022 and 2026
  are supported. To force a version for one command, set the
  `npm_config_msvs_version` environment variable.
- `pnpm install` no longer compiles `ced`, `keytar` and `native-keymap` at
  install time. That step ran pnpm's bundled node-gyp, which does not
  recognise Visual Studio 2026, and its output was thrown away: the
  post-install step rebuilds the same three modules with `electron-rebuild`.
- Required components are unchanged apart from the version: the "Desktop
  development with C++" workload and the x64/x86 Spectre-mitigated libraries
  for the same toolset. Without the Spectre libraries the build stops with
  `MSB8040`.

### Behaviour changes to be aware of

- Tabs and the title share a row; the file path is no longer shown while the
  tab bar is visible.
- The word count is in the bottom-right corner.
- Markdown files have no icon in the file tree.
- The light theme's accent and text colours changed, as listed above.
- This fork keeps upstream's application ID (`com.github.marktext.marktext`)
  and name, so the operating system does not see it as a separate application
  from the official MarkText. Expect the two to share settings rather than run
  side by side.
- "Check for Updates" and the links in the Help menu still point at the
  upstream project, not at this fork.

### Verification

- Automated tests, run on Linux: 331 end-to-end tests pass and 4 are skipped;
  1,030 of 1,033 unit tests pass. The three failures are environment-specific
  and also occur on the unmodified upstream code in the same environment.
  New tests cover the accent colour (13 unit, 3 end-to-end).
- Windows: `pnpm install` and `pnpm run dev` succeed with Build Tools for
  Visual Studio 2026 (18.10) as the only Visual Studio installed, and the
  development build runs.
- Themes checked by eye: light, dark, Nord and Graphite.

### Known limitations

- macOS has not been tested. The layout reserves room for the window buttons
  when the sidebar is hidden, but this has not been seen on a Mac.
- No installer was built or tested for this release; only the development
  build was run.
- Light accents such as Dusty Pink or Nokia Light Blue give low-contrast link
  text on a white page.
- The theme preview cards in Preferences show each theme's own colours and do
  not reflect a custom accent.
- The command palette, dialogs, the find bar and the editor's floating
  toolbars keep their previous styling.
- "Nokia Light Blue" and "Dusty Pink" have no single authoritative value; the
  presets are close matches.
