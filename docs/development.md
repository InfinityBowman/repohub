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
      App.tsx           # Hash router with 8 routes (/, /repo/:id, /github, /search, /agents, /packages, /ports, /settings)
      views/            # Page-level components
        RepositoriesView     # Dashboard with repo cards
        RepositoryDetailView # Full detail page for a single repo
        GitHubView           # PR dashboard
        CodeSearchView       # Semantic code search
        AgentCommandCenterView # Agent Command Center (Claude Code agents)
        PackagesView         # Package Intelligence (npm explorer)
        PortsView            # Port monitor (auto-refreshes on mount)
        SettingsView         # App settings
      components/       # UI components
        repository/     # RepositoryCard, HealthBadge, WorkspacePackageList, BranchCleanup, etc.
        github/         # PRBadge, CreatePRButton
        process/        # TerminalOutput (xterm.js)
        agents/         # AgentLaunchPanel, AgentTerminal, InfoBar, MessageInput, PermissionRequestInline, EmptyState
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

## IPC Channels

| Channel | Direction | Description |
|---------|-----------|-------------|
| `github:trending` | Renderer → Main | Search trending GitHub repos. Args: `language?: string, period?: string`. Returns `TrendingRepo[]`. |
| `package-clone:clone` | Renderer → Main | Shallow-clone a package's GitHub repo. Args: `packageName: string, repoUrl: string`. Returns `CloneResult`. |
| `package-clone:status` | Renderer → Main | Get clone status for a package. Args: `packageName: string`. Returns `CloneStatus`. |
| `package-clone:list-files` | Renderer → Main | List files in a cloned repo directory. Args: `packageName: string, relativePath: string`. Returns `FileNode[]`. |
| `package-clone:read-file` | Renderer → Main | Read a file from a cloned repo. Args: `packageName: string, relativePath: string`. Returns `string`. |
| `package-clone:delete` | Renderer → Main | Delete a cloned repo. Args: `packageName: string`. Returns `CloneResult`. |
| `agent:launch` | Renderer → Main | Launch a Claude Code agent. Args: `AgentLaunchConfig`. Returns `{ sessionId: string }`. |
| `agent:stop` | Renderer → Main | Stop a running agent. Args: `sessionId: string`. Returns `{ success: boolean }`. |
| `agent:send-message` | Renderer → Main | Send a follow-up message. Args: `{ sessionId, content }`. |
| `agent:respond-permission` | Renderer → Main | Respond to a permission request. Args: `{ sessionId, requestId, allow }`. |
| `agent:list` | Renderer → Main | List all agent sessions. Returns `AgentSessionInfo[]`. |
| `agent:get-messages` | Renderer → Main | Get message history. Args: `sessionId`. Returns `AgentMessage[]`. |
| `agent:status-changed` | Main → Renderer | Agent state changed. Data: `AgentSessionInfo`. |
| `agent:output` | Main → Renderer | New agent message. Data: `{ sessionId, message: AgentMessage }`. |
| `agent:permission-request` | Main → Renderer | Agent needs permission. Data: `{ sessionId, permission: PermissionRequest }`. |
| `agent:stream` | Main → Renderer | Streaming text delta. Data: `{ sessionId, delta: string }`. |

For a full list of IPC channels, see the preload bridge at `src/preload/index.ts`.

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
