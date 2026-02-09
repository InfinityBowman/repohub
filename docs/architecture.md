# Architecture

## Three-Process Electron Model

```
Main Process (Node.js)            Preload (context bridge)           Renderer (Chromium/React)
  src/main/                         src/preload/index.ts               src/renderer/
  ├── index.ts (entry)                                                 ├── App.tsx (routes)
  ├── window.ts                                                        ├── views/
  ├── services/                                                        │   ├── RepositoriesView
  │   ├── RepositoryService       ← filesystem scan, git info         │   ├── GitHubView
  │   ├── ProcessService          ← PTY via node-pty                  │   ├── PortsView
  │   ├── PortService             ← lsof polling                     │   └── SettingsView
  │   ├── ConfigService           ← electron-store persistence        ├── components/
  │   ├── LogService              ← terminal output to disk           ├── hooks/
  │   ├── DependencyHealthService ← npm/pnpm audit + outdated         └── store/ (Zustand)
  │   ├── GitHubService           ← gh CLI integration
  │   ├── ProjectDetector         ← project type heuristics
  │   └── WorkspaceDetector       ← pnpm workspace parsing
  ├── ipc/                        ← IPC handler registration
  └── types/                      ← shared type definitions
```

## IPC Communication Flow

```
React hook                   Preload bridge               IPC handler              Service
  useProcesses()  ──────►  window.electron.*  ──────►  ipcMain.handle()  ──────►  ProcessService
       ▲                                                                              │
       │                                                                              │ emit event
  Zustand store  ◄──────  onUpdate callback  ◄──────  webContents.send  ◄──────────┘
```

1. React hooks call `window.electron.*` methods exposed by the preload script
2. These invoke `ipcRenderer.invoke()` which maps to `ipcMain.handle()` in the main process
3. IPC handlers call into service methods and return results
4. Services emit domain events (e.g., `output`, `changed`, `health-changed`)
5. IPC handlers forward events to the renderer via `webContents.send()`
6. Preload listeners update Zustand stores, triggering React re-renders

## Key Design Decisions

### Async Shell Commands

All external tool calls (`git`, `gh`, `npm`/`pnpm`, `lsof`) use async `exec` (promisified `child_process.exec`) instead of `execSync`. This prevents blocking Electron's main thread, which would cause the spinning beach ball.

- Git info for all repos is fetched in parallel via `Promise.all`
- GitHub PR fetches run in concurrent batches of 5
- Dependency health checks run audit and outdated in parallel per repo

### PATH Augmentation

macOS packaged apps (`.app` bundles) inherit a minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`). The main process prepends common tool directories at startup:

- `/opt/homebrew/bin` and `/opt/homebrew/sbin` (Apple Silicon Homebrew)
- `/usr/local/bin` and `/usr/local/sbin` (Intel Homebrew / manual installs)

This ensures `gh`, `git`, `pnpm`, `node`, etc. are found without spawning a shell to read the user's PATH (which would be slow).

### StrictMode-Safe IPC Listeners

React 18+'s StrictMode double-mounts components in development. IPC event listeners use a module-level counter pattern to prevent double-registration. See `useProcesses.ts` for the reference implementation.

### Repository IDs

Each repository is identified by the first 12 characters of an MD5 hash of its full filesystem path. These IDs are used as keys for:

- Config overrides (custom run commands)
- Log files (terminal output persistence)
- Process tracking
- Health check cache

### Composite Process Keys

For monorepo workspace packages, process keys use the format `repoId:packageName` to allow running multiple packages from the same repo simultaneously.

## Build System

electron-vite (Vite-based) with three separate build targets configured in `electron.vite.config.ts`:

| Target | Environment | Output | Notes |
|---|---|---|---|
| main | Node.js | `out/main/` | Externalizes deps except electron-store |
| preload | Node.js | `out/preload/` | Externalizes all deps |
| renderer | Browser | `out/renderer/` | React + Tailwind plugins |

### Path Alias

`@/*` maps to `src/renderer/src/*`, configured in both `tsconfig.json` and `electron.vite.config.ts`.

## Security Model

| Setting | Value | Reason |
|---|---|---|
| `contextIsolation` | `true` | Renderer cannot access Node APIs directly |
| `nodeIntegration` | `false` | All IPC goes through the preload bridge |
| `sandbox` | `false` | Disabled because node-pty requires it; acceptable since no untrusted content is loaded |
