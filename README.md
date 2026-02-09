# RepoHub

<p align="center">
  <img src="build/icon.png" width="128" height="128" alt="RepoHub icon">
</p>

A native macOS desktop app for managing local development projects. Scans your repos directory, auto-detects project types, and lets you run, monitor, and navigate everything from one place.

## Features

- **Auto-discovery** -- recursively scans a configurable directory and detects Node.js, Python, Rust, Go, Java, Swift, and monorepo projects
- **Inline terminal** -- run projects with auto-detected (or custom) commands and view output in an embedded terminal
- **Monorepo support** -- detects pnpm workspaces and Turborepo, with per-package terminals
- **Dependency health** -- run `npm audit` / `pnpm audit` and outdated checks with color-coded badges
- **GitHub integration** -- PR status badges, CI checks, and a unified PR dashboard (requires `gh` CLI)
- **Git status** -- shows current branch and dirty state; refreshes on focus
- **Port monitoring** -- tracks which localhost ports are in use and which projects own them
- **Open anywhere** -- VS Code and terminal buttons on every folder and repo in the tree
- **Search & filter** -- live filtering by name with result count
- **Persistent config** -- custom run commands, ignore patterns, and settings saved across sessions

## Tech Stack

Electron 40 &bull; React 19 &bull; TypeScript &bull; Vite (electron-vite) &bull; Tailwind CSS v4 &bull; shadcn/ui &bull; Zustand &bull; node-pty &bull; xterm.js

## Getting Started

```bash
pnpm install        # Install dependencies
pnpm dev            # Development mode with hot reload
pnpm install-app    # Build and install to /Applications
```

### Prerequisites

- **Node.js** v20+
- **pnpm**
- **GitHub CLI** (`gh`) -- optional, for the Pull Requests tab
  ```bash
  brew install gh && gh auth login
  ```

See [docs/](docs/) for detailed feature documentation and architecture notes.

## License

ISC
