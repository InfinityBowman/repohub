# RepoHub

<p align="center">
  <img src="build/icon.png" width="128" height="128" alt="RepoHub icon">
</p>

A desktop app for managing all your local projects from one place. Scans your repos directory, auto-detects project types, and lets you run, monitor, and navigate projects without leaving the app.

## Features

- **Auto-discovery** — Recursively scans `~/Documents/Repos` (configurable) and detects project types: Node.js, Python, Rust, Go, Java, Swift
- **Tree view** — Nested projects display in a collapsible folder tree, sorted by last modified
- **Inline terminal** — Run projects with auto-detected commands (`pnpm dev`, `cargo run`, etc.) and see output in an embedded xterm.js terminal
- **Custom run commands** — Override the detected command per repo, saved to config
- **Git status** — Shows current branch and dirty/clean state on each repo card; refreshes automatically when the app regains focus
- **Port monitoring** — Polls `lsof` every 5 seconds to show which processes own which localhost ports
- **Clickable URLs** — `localhost:PORT` and full URLs in terminal output are clickable and open in your browser
- **Open in editor/terminal** — One-click buttons to open any repo in VS Code or Ghostty
- **Log persistence** — Terminal output is saved to disk per repo and survives app restarts
- **Search/filter** — Filter repos by name, path, project type, or git branch with a live result count
- **Configurable** — Ignore patterns, scan directory, port scan interval, and per-repo command overrides

## Tech Stack

Electron 40 &bull; React 19 &bull; TypeScript &bull; Vite (electron-vite 5) &bull; Tailwind CSS v4 &bull; shadcn/ui &bull; Zustand &bull; node-pty &bull; xterm.js

## Getting Started

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build the macOS app
npm run dist
```

The built app will be at `release/mac-arm64/RepoHub.app`. Copy it to `/Applications` to keep it in your dock.

## Project Structure

```
src/
  main/               # Electron main process
    services/
      RepositoryService  # Recursive project scanning + git info
      ProcessService     # Process lifecycle via node-pty
      PortService        # localhost port monitoring
      ConfigService      # Persisted config via electron-store
      LogService         # Terminal output persistence
    ipc/               # IPC handlers bridging main <-> renderer
    types/             # Shared TypeScript types
  preload/             # Secure context bridge (contextIsolation)
  renderer/            # React frontend
    components/
      repository/      # RepositoryCard, ProjectBadge
      process/         # TerminalOutput (xterm.js)
      layout/          # AppLayout, Sidebar
      ui/              # shadcn/ui primitives
    views/             # RepositoriesView, PortsView, SettingsView
    hooks/             # useRepositories, useProcesses, useConfig, usePorts
    store/             # Zustand stores
```

## Configuration

Stored at `~/Library/Application Support/repohub/config.json`:

| Setting               | Default                              | Description                                     |
| --------------------- | ------------------------------------ | ----------------------------------------------- |
| `scanDirectory`       | `~/Documents/Repos`                  | Root directory to scan for projects             |
| `ignorePatterns`      | `node_modules`, `.git`, `ThirdParty` | Glob patterns to skip during scanning           |
| `portScanInterval`    | `5000`                               | Port monitoring poll interval in ms             |
| `commandOverrides`    | `{}`                                 | Per-repo custom run commands (keyed by repo ID) |
| `autoStartMonitoring` | `true`                               | Start port monitoring on app launch             |

## License

ISC
