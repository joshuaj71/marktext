# Development Rules

This file provides guidance to AI agents when working with code in this repository.

## Project Overview

MarkText is a WYSIWYG markdown editor built on Electron + Vue 3. It supports CommonMark, GitHub Flavored Markdown, math (KaTeX), Mermaid diagrams, PlantUML, and multiple editing modes (focus, typewriter, source-code).

- **Version**: see `package.json`
- **License**: MIT
- **Repository**: <https://github.com/marktext/marktext>

## Tech Stack

| Layer              | Technology                                                                           |
| ------------------ | ------------------------------------------------------------------------------------ |
| Language           | TypeScript 5.9 (strict mode) — `packages/muyajs/` is legacy JS, no longer referenced |
| Desktop shell      | Electron 42                                                                          |
| Build system       | electron-vite 5                                                                      |
| Packaging          | electron-builder 26                                                                  |
| Frontend framework | Vue 3                                                                                |
| State management   | Pinia 3                                                                              |
| Routing            | Vue Router 4                                                                         |
| UI library         | Element Plus                                                                         |
| Unit tests         | Vitest 4                                                                             |
| E2E tests          | Playwright                                                                           |
| Package manager    | pnpm >=10 workspace (`packageManager: pnpm@10.33.4`)                                 |
| Repo layout        | pnpm monorepo — see Directory Structure                                              |
| Node.js minimum    | >=20.19.0 (PR CI: Node 22.21.1 · release CI: Node 24.14.1)                           |

## Directory Structure

This is a pnpm workspace. Three packages live under `packages/`, and the
root holds only shared tooling and CI-facing scripts.

```
<repo-root>/
  package.json              Workspace orchestrator — every CI-facing script
                            proxies to packages/desktop via `pnpm --filter
                            marktext ...`. CI invocations are unchanged.
  pnpm-workspace.yaml       `packages: ['packages/*']` plus allowBuilds.
  pnpm-lock.yaml            Single lockfile, shared across all packages.
  eslint.config.js          Root ESLint v9 flat config (covers desktop +
                            muyajs; website has its own ESLint v8 config
                            and is ignored here).
  scripts/                  Workspace-level scripts. postinstall.ts,
                            minify-locales.ts, generateThirdPartyLicense.ts,
                            validateLicenses.ts, thirdPartyChecker.ts all
                            target packages/desktop internally.
  docs/                     Long-form developer docs.
  dist/                     Packaged installers from electron-builder
                            (git-ignored; electron-builder writes here via
                            `directories.output: ../../dist` so CI artifact
                            globs `dist/*` still apply).
  packages/
    desktop/                The Electron app (name: "marktext").
      package.json          Holds all Electron / Vue / build-time deps and
                            the dev/build/test/typecheck scripts. Depends on
                            @muyajs/core via workspace:*.
      electron.vite.config.ts
      electron-builder.yml  directories.output points at ../../dist.
      tsconfig.json / tsconfig.base.json
      vitest.config.ts
      playwright.config.ts  Must stay here, not in test/e2e/ — Playwright only
                            auto-loads a config from the directory it runs in.
      patches/              pnpm patches consumed by patch-package.
      build/                electron-builder resources (icons, entitlements,
                            NSIS scripts).
      static/               Static assets bundled into the app
                            (icons, themes, locales).
      out/                  electron-vite output (git-ignored).
      test/
        unit/               Vitest specs → pnpm test / pnpm test:unit
        e2e/                Playwright specs → pnpm test:e2e
      src/
        common/             Pure Node.js utilities usable from main, preload,
                            and renderer.
        main/               Electron main process (IO, native dialogs, window
                            management, auto-updater).
        preload/            Electron preload scripts. The renderer runs
                            sandboxed (contextIsolation: true,
                            nodeIntegration: false, sandbox: true since
                            #4244) — all Node access flows through the typed
                            contextBridge surface in
                            packages/desktop/src/preload/index.ts.
        renderer/           Vue 3 application (editor UI, Pinia stores).
          src/
            components/     Vue single-file components.
            store/          Pinia stores (editor.ts, preferences.ts,
                            layout.ts, …).
            pages/          Top-level Vue pages / routes.
            router/         Vue Router configuration.
        shared/             Cross-process types (`shared/types/`) and the
                            IPC contract (`shared/types/ipc.ts`).
        types/              Ambient .d.ts declarations.
    muyajs/                 Legacy markdown editor engine
                            (name: "@marktext/muyajs"). Primarily JS + DOM,
                            avoids Electron APIs. Exception:
                            packages/muyajs/lib/parser/render/plantuml.js
                            imports Node's `zlib`. Nothing imports it any
                            more — the desktop renderer consumes
                            @muyajs/core (packages/muya), and the `muya/*`
                            alias, the `src/types/muya.d.ts` bridge and the
                            workspace dep are gone (#4257). The package
                            itself is deleted post-0.20.0.
      lib/
        contentState/       Block structure and document transformations.
        parser/             Markdown parser.
        renderers/          WYSIWYG renderer.
        ui/                 Inline toolbar, emoji picker, etc.
        utils/              Internal utilities.
      themes/               Editor themes (Prism + fonts).
    muya/                   TypeScript rewrite of muya
                            (name: "@muyajs/core"; upstream:
                            https://github.com/marktext/muya). Built on
                            ot-json1 + ot-text-unicode + snabbdom + marked@16
                            + rxjs. Self-contained: own eslint config
                            (antfu), own stylelint, own madge, own vitest
                            spec suites (CommonMark + GFM). The editor
                            engine the desktop renderer consumes. See
                            packages/muya/AGENTS.md for layout and commands.
      src/                  TS source. Public entrypoint src/index.ts.
      test/spec/            CommonMark 0.31 + GFM 0.29-gfm conformance.
      examples/             muya-examples — vite vanilla-TS dev demo
                            (listed in pnpm-workspace.yaml).
      e2e/                  muya-e2e — Playwright suite. CI runs Chromium
                            only via muya-e2e.yml; Firefox + WebKit are
                            wired in playwright.config.ts but deferred
                            until BACKLOG Phase 3 lands engine-independent
                            specs.
    website/                marktext-website (Vite + React 18). Standalone
                            toolchain; depends on @muyajs/core from npm,
                            not on the local muyajs package. Not part of
                            desktop CI today.
      src/ / public/ / build/ / vite.config.ts / tsconfig.json
```

The root has no `src/`, `test/`, `static/`, or `build/` of its own anymore — they all live in `packages/desktop/`.

## Development Workflow

All commands run from the repo root. The root `package.json` proxies every
desktop-specific script to `packages/desktop` via `pnpm --filter marktext`,
so the names and behavior are unchanged from the pre-monorepo layout.

```bash
# Install dependencies (runs scripts/postinstall.ts automatically — patches
# native-keymap, downloads Electron, rebuilds native modules, minifies locales)
pnpm install

# Run in development mode
# Renderer hot-reloads automatically. Pressing Ctrl+R in the dev window reloads
# the renderer (which re-runs the preload script); changes to the main process
# require restarting `pnpm run dev`.
pnpm run dev

# Preview the last electron-vite build (no rebuild).
pnpm run start

# Build without packaging — fast path for verifying the renderer/main compile
pnpm run build:unpack

# Auto-format the repo with Prettier (separate from `lint`, which only checks)
pnpm run format

# Minify locale files (required for production builds, skip during dev)
pnpm run minify-locales

# Performance debugging — exposes a Node inspector on :5858 against the previewed build
pnpm run perf:inspect       # attach when ready
pnpm run perf:inspect-brk   # break on first line

# Website (not yet wired into CI)
pnpm --filter marktext-website dev      # Vite dev server
pnpm --filter marktext-website build    # static build → packages/website/build/
```

If you need to invoke a script directly inside a package, use
`pnpm --filter <name> <script>` or `pnpm -C packages/<name> <script>`.

## Build Commands

```bash
pnpm run build:win    # Windows x64 — NSIS installer + zip
pnpm run build:mac    # macOS x64 + arm64 — DMG + zip
pnpm run build:linux  # Linux — AppImage, snap, deb, rpm, tar.gz
```

All platform build scripts automatically run `minify-locales` and `electron-rebuild` before packaging.

## Testing

```bash
pnpm run test          # All unit tests (Vitest)
pnpm run test:unit     # Unit tests only
pnpm run test:e2e      # End-to-end tests (Playwright)
pnpm run lint          # ESLint (run before committing; CI enforces)
pnpm run typecheck     # vue-tsc --noEmit (CI enforces)

# Run a single spec — paths are relative to packages/desktop. Use `-C` so
# pnpm resolves the spec path inside the desktop package's vitest config.
pnpm -C packages/desktop exec vitest run test/unit/specs/markdown-basic.spec.ts
pnpm -C packages/desktop exec vitest run -t 'partial test name'

# Single Playwright spec (playwright.config.ts sits at packages/desktop/, so it
# is picked up automatically — run these from that package, not the repo root)
pnpm -C packages/desktop exec playwright test test/e2e/launch.spec.ts
pnpm -C packages/desktop exec playwright test -g 'partial test name'
```

## Code Style

Enforced by ESLint + Prettier. Run `pnpm run lint` and `pnpm run typecheck` before committing.

- 2-space indentation
- No semicolons
- Single quotes
- TypeScript with `strict: true`; see `packages/website/content/docs/dev/TYPESCRIPT.md`
- Cross-process types live in `packages/desktop/src/shared/types/`; ambient declarations in `packages/desktop/src/types/`
- IPC channels are typed via the contract in `packages/desktop/src/shared/types/ipc.ts`
- The renderer is fully sandboxed — every IPC and Node access goes through `window.electron.*` / `window.fileUtils.*` etc. (typed in `packages/desktop/src/types/global.d.ts`)

### Comments

Follow `.github/COMMENTING-GUIDELINES.md` for every comment you write. The core rule: a comment must describe what isn't obvious from the code — rationale, units, invariants, ownership, the abstraction a caller needs — never restate the code or echo the words already in the name. Before finishing any change, review the comments you added or touched against that document, and delete any that only repeat the code. Prefer self-explanatory names over comments; when a comment is genuinely needed, keep it short and complete and place it next to the code it describes.

## Architecture: Three-Process Electron Model

All Electron processes live in `packages/desktop/`. Muya is a separate
workspace package that the renderer (and tests) consume as `@muyajs/core`.

```
main process  (packages/desktop/src/main/)
  ├── Full Node.js + Electron API access
  ├── IO, file system, native dialogs, auto-updater, spell checker
  ├── One instance per application launch
  └── Controls editor windows via IPC

preload  (packages/desktop/src/preload/)
  ├── Bridge between main and renderer
  ├── Note: editor and preferences windows use contextIsolation: false +
  │   nodeIntegration: true (see packages/desktop/src/main/config.js)
  └── Compiled to CommonJS

renderer  (packages/desktop/src/renderer/)
  ├── One process per editor window (spawned by main)
  ├── Vue 3 + Pinia — all UI state and editor interaction
  ├── Hosts both Muya (WYSIWYG) and CodeMirror (source-code mode)
  └── Compiled to ES Modules only

Muya  (packages/muya/)              ← workspace package @muyajs/core
  ├── Self-contained editor backend, TypeScript
  ├── No Electron APIs
  ├── Handles markdown parsing, block data structure, document export, rendering
  └── packages/muyajs/ (the legacy JS engine) is unreferenced and is
      deleted post-0.20.0.
```

## IPC Conventions

Most IPC channels between main and renderer use the `mt::` prefix (e.g. `mt::open-new-tab`, `mt::file-saved`). Some internal channels do not follow this convention (e.g. `language-changed`).

See `packages/website/content/docs/dev/IPC.md` for conventions and examples.

## Further Reading

`packages/website/content/docs/dev/` contains the deeper developer documentation referenced by this guide. Same files are published as the developer docs section on <https://marktext.me/docs/dev/overview>:

- `ARCHITECTURE.md` — process/module layering beyond the summary above
- `BUILD.md` — full platform build prerequisites (including the Arch Linux deps added recently)
- `DEBUGGING.md` — attaching debuggers to main/renderer processes
- `INTERFACE.md` — Muya and renderer public interfaces
- `IPC.md` — full IPC channel catalog and `mt::` conventions
- `LINUX_DEV.md` — Linux-specific dev environment setup
- `PERFORMANCE.md` — perf measurement workflow (pairs with `pnpm run perf:inspect`)
- `RELEASE.md` / `RELEASE_HOTFIX.md` — release process

## Important Build Notes

- **CommonJS vs ESM**: `main` and `preload` compile to CommonJS; `renderer` is ESM-only. Do not use `require()` in renderer code.
- **Minify locales**: `pnpm run minify-locales` must run before production builds. It is included in `build:win/mac/linux` but not in `dev`.
- **Native modules**: After changing Electron version, run `pnpm run rebuild-native` (`electron-rebuild -f`).
- **Hot reload**: The renderer hot-reloads via Vite HMR. `Ctrl+R` in the dev window reloads the renderer and re-runs the preload script. Changes to `main/` source are NOT picked up by a window reload — restart `pnpm run dev` to pick them up.
- **electron-builder output**: `directories.output` in `packages/desktop/electron-builder.yml` is set to `../../dist` so installers land in the repo-root `dist/` (where CI artifact globs look for them). `out/` from electron-vite stays inside `packages/desktop/`.
- **Path aliases** (defined in `packages/desktop/electron.vite.config.ts`, mirrored in `vitest.config.ts` and `tsconfig.base.json`):
  - `@` → `packages/desktop/src/renderer/src`
  - `common` → `packages/desktop/src/common`
  - `@shared` → `packages/desktop/src/shared`
- **`@muyajs/core` resolution**: not a path alias — electron-vite and Vitest resolve it through the package's `exports` map, which points at `packages/muya/src/index.ts`. TypeScript would then pull the whole muya tree into the desktop's program, so `tsconfig.base.json` redirects the types to `../muya/lib/types/index.d.ts`; `pnpm typecheck` and `postinstall` both run `pnpm --filter @muyajs/core build:types` to emit that (git-ignored) directory.
- **Patches**: `patch-package` patches live at `packages/desktop/patches/`. The root `postinstall` calls patch-package with `cwd=packages/desktop` so the path resolves correctly.

## Contribution

- Submit PRs to the **`develop`** branch (not `main`).
- Reference the related issue in the PR description.
- Run `pnpm run lint` before submitting.
- All PRs must pass CI before merge.
- See `.github/CONTRIBUTING.md` for the full contributing guide.

## Next Phase (Planned)

This repository is a fork shipped as **Joshua MarkText** (`ui-refresh` branch,
released as 1.1.0). The phase after 1.1.0 already delivered: switchable app
and `.md` icons (Preferences › Theme › App Icon; artwork from
`pnpm run generate-icons`), native window buttons on Windows, readable accent
links and accent-aware theme previews, a tab overflow menu, sidebar header
actions and hidden `.md` extensions, and the restyled command palette, find
bar, dialogs and editor menus
(`packages/desktop/src/renderer/src/assets/styles/surfaces.css`). The work
below is what comes next.

### Release and distribution

- Bump the version to 1.2.0 in `package.json` and `packages/desktop/package.json`,
  add the release to `RELEASE_NOTES.md`, tag it, and enable GitHub Actions so
  `.github/workflows/release.yml` builds the installers.
- Verify the icon switch in an installed build, with both a per-user and an
  all-users install: the `.md` icon (an HKCU `DefaultIcon` override), the
  shortcuts (a UAC prompt for all-users shortcuts), and the re-sync on startup
  after an update or a reinstall (`packages/desktop/src/main/app/appIcon.ts`).
- Sign the Windows installer, so SmartScreen stops warning (needs a certificate).
- Replace the upstream logo in `README.md` and `docs/assets/` with the new icon.

### Icons

- All-users installs: a manual reinstall recreates the shortcuts in the default
  colour, and the app asks for administrator rights only when a colour is
  chosen, so they stay that way until then. Add a way to re-apply (a button in
  Preferences, or the installer reading the preference).
- More colour variants: add to `APP_ICON_VARIANTS` in
  `packages/desktop/src/common/appIcon.ts` and to the `appIcon` enum in
  `packages/desktop/src/main/preferences/schema.json`, then run
  `pnpm run generate-icons`.

### UI

- The Preferences window still draws its own close button; give it the native
  window controls on Windows, as the editor window has.
- Linux still uses page-drawn window buttons; Electron's window controls overlay
  works there as well.
- The theme preview cards show a custom accent on every card, but in the editor
  a theme whose links have a hue of their own keeps it (`accentFollowerValue`
  in `packages/desktop/src/renderer/src/util/accentColor.ts`). Read each
  theme's real link colour instead.
- Sidebar: the new-item input's placeholder ("Enter .md file name", in
  `packages/desktop/src/renderer/src/components/sideBar/tree.vue`) is
  hard-coded English and is also shown when creating a folder. Translate it
  and word it per item type.
- The restyled editor menus and toolbars have no visual tests; the emoji picker
  in particular could not be opened from Playwright.

### Tests and tooling

- These e2e specs fail on a Windows 10 machine with a Chinese system locale, and
  already did at 1.1.0:
  - `issue-2245-window-menu-bar.spec.ts`: the Preferences window's chrome
    measures 38px instead of 37px after focus moves (DPI rounding?).
  - `issue-3148-sidebar-delete-key.spec.ts`: Delete on the sidebar selection
    opens no trash confirmation.
  - `find-replace.spec.ts`, regex toggle: expects the English error text while
    the app follows the system language; seed `language: 'en'` in the launch.
  - `search-prefill-from-selection.spec.ts`: on Windows a double-click selects
    the word plus its trailing space.
- The repo pins pnpm 10.33.4 (`packageManager`). A newer pnpm (12.x was tried)
  reinstalls `node_modules` without the `.npmrc` settings, `shamefully-hoist`
  included, after which ESLint cannot resolve `@eslint/js`. Move those settings
  into `pnpm-workspace.yaml` before upgrading pnpm; until then use pnpm 10.
