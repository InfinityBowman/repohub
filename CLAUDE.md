# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RepoHub is a native macOS desktop app (Electron) that serves as a project management dashboard. It scans a local repos directory, auto-detects project types, provides inline terminals for running projects, monitors open ports, and tracks Git status.

## Commands

```bash
pnpm dev          # Development mode with hot reload
pnpm build        # Compile TypeScript to out/
pnpm dist         # Build + package macOS .app to release/
pnpm install-app  # dist + copy to /Applications
pnpm typecheck    # Type-check only (tsc --noEmit)
```

No test framework or linter is configured. `pnpm run typecheck` is the primary validation command.

## Architecture

### Three-Process Electron Model

```
Main Process (Node.js)          Preload (context bridge)          Renderer (Chromium/React)
  src/main/                       src/preload/index.ts              src/renderer/
  ├── index.ts (entry)                                              ├── views/
  ├── services/                                                     ├── components/
  ├── ipc/                                                          ├── hooks/
  └── types/                                                        └── store/
```

**IPC communication flow:**
React hooks → `window.electron.*` (preload bridge) → IPC handlers (`src/main/ipc/`) → Service layer (`src/main/services/`) → events back via `webContents.send` → preload listeners → Zustand stores → React re-renders.

### Main Process Services (`src/main/services/`)

- **RepositoryService** — Recursive filesystem scan, project type detection, git info extraction (via `execSync`), file watching (chokidar)
- **ProcessService** — PTY process lifecycle via node-pty, output buffering (50ms debounce), emits events
- **PortService** — Polls `lsof` every 5 seconds, links ports to managed processes
- **ConfigService** — Persists to electron-store (`~/Library/Application Support/repohub/config.json`)
- **LogService** — Terminal output to disk per repo (100KB max per file)
- **ProjectDetector** — Heuristic detection: Node.js, Python, Rust, Go, Java, Swift

### Renderer Architecture (`src/renderer/src/`)

- **State**: Zustand stores in `store/` (repositoryStore, processStore, portStore)
- **IPC wrappers**: Custom hooks in `hooks/` (useRepositories, useProcesses, usePorts, useConfig)
- **Routing**: react-router-dom with hash-based routing
- **UI**: shadcn/ui components in `components/ui/`, Tailwind CSS v4, Lucide icons
- **Terminal**: xterm.js with fit addon and clickable URL detection

### Path Alias

`@/*` maps to `src/renderer/src/*` (configured in tsconfig.json and electron.vite.config.ts).

### Key Identifiers

Repository IDs are MD5 hashes (first 12 chars) of the full filesystem path, used as keys for config overrides and log files.

## Build System

electron-vite (Vite-based) with three separate build targets in `electron.vite.config.ts`:

- **main**: Node.js target, externalizes deps except electron-store
- **preload**: Node.js target, externalizes all deps
- **renderer**: Browser target with React and Tailwind plugins

Output goes to `out/main/`, `out/preload/`, `out/renderer/`.

## Security Model

- `contextIsolation: true` — Renderer cannot access Node APIs directly
- `nodeIntegration: false` — All IPC goes through the preload bridge
- `sandbox: false` — Disabled because node-pty requires it; acceptable since no untrusted content is loaded
