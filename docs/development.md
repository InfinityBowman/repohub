# Development

## Commands

```bash
pnpm dev            # Dev mode with hot reload (main + preload + renderer)
pnpm build          # Compile TypeScript to out/
pnpm dist           # Build + package macOS .app to release/
pnpm install-app    # dist + copy to /Applications
pnpm typecheck      # Type-check only (tsc --noEmit)
```

## Prerequisites

- **Node.js** v20+
- **pnpm** (all commands use pnpm, not npm/yarn)
- **Xcode Command Line Tools** (for native module compilation: node-pty)

### Optional

- **GitHub CLI** (`gh`) -- for the Pull Requests feature
  ```bash
  brew install gh
  gh auth login
  ```

## Project Structure

```
src/
  main/                 # Electron main process (Node.js)
    index.ts            # Entry point, service initialization, PATH fix
    window.ts           # BrowserWindow creation
    services/           # Business logic (EventEmitter-based)
    ipc/                # IPC handler registration
    types/              # TypeScript type definitions
  preload/              # Context bridge (secure IPC layer)
    index.ts            # Exposes window.electron.* API
  renderer/             # React frontend (Chromium)
    src/
      App.tsx           # Hash router with 6 routes (/, /repo/:id, /github, /search, /ports, /settings)
      views/            # Page-level components
        RepositoriesView     # Dashboard with repo cards
        RepositoryDetailView # Full detail page for a single repo
        GitHubView           # PR dashboard
        CodeSearchView       # Semantic code search
        PortsView            # Port monitor (auto-refreshes on mount)
        SettingsView         # App settings
      components/       # UI components
        repository/     # RepositoryCard, HealthBadge, WorkspacePackageList, BranchCleanup, etc.
        github/         # PRBadge, CreatePRButton
        process/        # TerminalOutput (xterm.js)
        scaffold/       # ScaffoldDialog, ScaffoldTerminal (project creation)
        layout/         # AppLayout, Sidebar
        icons/          # Custom SVG icons (VSCodeIcon)
        ui/             # shadcn/ui primitives (tooltip, dialog, badge, etc.)
      hooks/            # IPC wrapper hooks (useRepositories, useProcesses, etc.)
      store/            # Zustand stores
      types/            # Renderer-side type definitions
```

## Adding a shadcn/ui Component

Components live in `src/renderer/src/components/ui/`. Follow the pattern of existing components like `tooltip.tsx` or `dialog.tsx`. Import Radix primitives from the unified `"radix-ui"` package (not `@radix-ui/react-*`).

## Adding a New IPC Channel

Follow the existing pattern:

1. **Service** (`src/main/services/`) -- add business logic, emit events
2. **IPC handler** (`src/main/ipc/`) -- register `ipcMain.handle()`, forward events via `webContents.send()`
3. **Preload bridge** (`src/preload/index.ts`) -- expose via `contextBridge.exposeInMainWorld()`
4. **Hook** (`src/renderer/src/hooks/`) -- call `window.electron.*`, manage state
5. **Types** -- update `src/main/types/` and `src/renderer/src/types/`

## Validation

No test framework or linter is currently configured. The primary validation command is:

```bash
pnpm typecheck
```

Run this before committing to catch type errors.

## Building for Distribution

```bash
pnpm dist
```

This produces `release/mac-arm64/RepoHub.app`. To install:

```bash
pnpm install-app    # Copies to /Applications
```

The app is configured as a directory target (not DMG) for fast iteration.
