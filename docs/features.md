# Features

## Repository Dashboard

The home screen scans a configurable root directory (defaults to `~/Documents/Repos`) and displays all detected projects in a grouped tree view.

### Repository List

Repository cards show the project name, type badge, health badge, git branch, PR status, and quick-action buttons (VS Code, Ghostty, GitHub, Start/Stop/Restart). Clicking a card navigates to its detail view.

Repositories are sorted by last modified time. Use the search bar to filter by name.

### Project Detection

Projects are auto-detected by checking for marker files:

| Project Type | Detection                                          | Default Command                                     |
| ------------ | -------------------------------------------------- | --------------------------------------------------- |
| Monorepo     | `pnpm-workspace.yaml` + `package.json`             | `turbo dev` (if turbo.json) or `pnpm dev`           |
| Node.js      | `package.json`                                     | `pnpm dev` / `yarn dev` / `npm run dev` / `bun dev` |
| Rust         | `Cargo.toml`                                       | `cargo run`                                         |
| Python       | `pyproject.toml` / `requirements.txt` / `setup.py` | `python main.py`                                    |
| Go           | `go.mod`                                           | `go run .`                                          |
| Swift        | `Package.swift`                                    | `swift run`                                         |
| Java         | `pom.xml` / `build.gradle` / `build.gradle.kts`    | none                                                |

Package manager is detected from lock files: `pnpm-lock.yaml` -> pnpm, `yarn.lock` -> yarn, `bun.lockb`/`bun.lock` -> bun, otherwise npm.

### Repository Detail View

Clicking a repository card navigates to a full-page detail view (`/repo/:id`) with these sections:

- **Header** -- repo name, badges (project type, health, packages, git branch, PR status, running state), and action buttons (VS Code, Ghostty, GitHub, Create PR, Start/Stop/Restart). Sticky at the top with a back button.
- **Process** -- command editor (click pencil to override the detected command) and xterm.js terminal output. Shows a helpful empty state when no process is running.
- **Packages** (monorepo only) -- workspace package list with per-package start/stop/restart and embedded terminals.
- **package.json preview** -- collapsible section showing the raw file contents in a scrollable code block. Uses a generic `repo:read-file` IPC channel with path traversal protection.
- **Branch Cleanup** -- collapsible section listing all local branches with merged/current badges, individual delete buttons, and a "Delete All Merged" bulk action. See [Branch Cleanup](#branch-cleanup) below.

Press `Escape` to navigate back to the dashboard.

### Custom Run Commands

Click the pencil icon in the detail view's process section to override the auto-detected command (e.g., change `pnpm dev` to `pnpm dev --port 4000`). Overrides persist across sessions in the app config.

### Terminal

The detail view includes an xterm.js terminal. Terminal output supports:

- Clickable URLs (opens in browser)
- Terminal output is saved to disk per repo and survives app restarts
- Output is capped at 100KB per repo log file
- Empty state with guidance when no process has been started

### Git Status

Each card shows the current branch with a blue badge. An amber dot appears when there are uncommitted changes. Git info refreshes automatically when the app window regains focus.

---

## Monorepo Awareness

RepoHub detects pnpm workspace monorepos and provides workspace-level features:

- **Package count badge** (e.g., "3 pkgs") on the repository card
- **Turborepo badge** when `turbo.json` is present
- **Per-package terminals** -- expand the card to see individual workspace packages, each with their own play/stop/restart controls and embedded terminal output

Workspace detection reads `pnpm-workspace.yaml` to find package globs, then scans for individual `package.json` files within those directories.

---

## Dependency Health

For Node.js and monorepo projects, a shield badge on each card indicates dependency health.

### Badge Colors

| Badge         | Meaning                                                       |
| ------------- | ------------------------------------------------------------- |
| Gray shield   | Not yet checked -- click to run a check                       |
| Spinning      | Check in progress                                             |
| Green shield  | Healthy -- no vulnerabilities, dependencies up to date        |
| Yellow shield | Warnings -- some high-severity vulns or 5+ outdated packages  |
| Red shield    | Critical -- critical vulnerabilities or 5+ high-severity ones |

### Detail Popover

Click a colored badge to open a popover showing:

- Vulnerability breakdown (critical / high / moderate / low counts)
- Outdated dependency counts (major / minor / patch)
- Last checked timestamp
- Refresh button to re-check

### Check All

The **"Check All"** button in the toolbar runs health checks across all Node.js/monorepo projects at once.

### How It Works

Under the hood, RepoHub runs:

- `npm audit --json` or `pnpm audit --json` for vulnerabilities
- `npm outdated --json` or `pnpm outdated --format json` for outdated packages

Results are cached in memory and displayed until manually refreshed.

### Thresholds

- **Red**: 1+ critical vulnerabilities or 5+ high-severity
- **Yellow**: 1+ high-severity or 5+ total outdated
- **Green**: everything else

---

## GitHub Integration

Requires the [GitHub CLI](https://cli.github.com/) (`gh`) to be installed and authenticated (`gh auth login`).

### PR Badges on Repository Cards

When a repo's current branch has an associated pull request, a PR badge appears showing:

- PR number
- CI status dot (green = passing, red = failing, yellow = pending, gray = unknown)
- PR state coloring (green = open, gray = draft, purple = merged, red = closed)

Click the badge to open the PR on GitHub.

### Create PR Button

When on a non-main branch with no existing PR, a "Create PR" button appears. This opens `gh pr create --web` in the browser.

### Pull Requests Tab

A unified dashboard at `/github` showing all your open and draft PRs across scanned repos. Each PR card shows:

- Title, state badge, and CI status
- PR number, repo name, branch info, and creation date
- External link button to open on GitHub

### Refresh Behavior

- **Manual refresh** -- button in the PR tab header. Scans all repos.
- **Auto-refresh** -- triggers when the app window regains focus, subject to a 2-minute cooldown. Only scans the 5 most recently modified repos for speed.

### Troubleshooting

If the PR tab shows "GitHub CLI (gh) is not installed":

1. Install: `brew install gh`
2. Authenticate: `gh auth login`
3. Restart RepoHub

---

## Branch Cleanup

The branch cleanup panel lives in the repository detail view as a collapsible section. It helps keep local branches tidy by identifying and deleting merged branches.

### How It Works

- Lists all local branches using `git branch -vv` with tracking info and last commit dates
- Detects merged branches using `git branch --merged main` (falls back to `master`)
- Shows each branch with its name, current/merged badges, upstream tracking info, and last commit date

### Deleting Branches

- **Individual delete** -- click the trash icon next to any merged branch
- **Delete All Merged** -- bulk-delete all merged branches at once
- **Safety guards** -- never deletes the current branch, `main`, `master`, or `develop`
- Uses `git branch -d` (safe delete) which refuses to delete unmerged branches

### Command Palette

The "Clean Branches" action is available in the command palette (Cmd+K) when a repo is selected, navigating directly to the detail view.

---

## Quick Scaffold — Project Creation

Create new projects from the dashboard using the "New Project" button or Cmd+K command palette.

### Templates (Primary)

The primary flow uses a **Project Templates Directory** configured in Settings. Each subdirectory in that directory is a template. When you create a project from a template, the entire template directory is copied into the scan directory with your chosen project name — no CLI tools required.

1. Click "New Project" or use Cmd+K → "New Project"
2. Pick a template from the grid
3. Enter a project name (validated: no spaces/special chars)
4. Files are copied instantly
5. Click "Open Project" to rescan and navigate to the new repo's detail view

### Custom Recipes (Secondary)

For power users, the dialog also offers "Custom Recipes" — shell commands that run in a PTY with an interactive xterm.js terminal. Recipes define scaffold commands with a `{name}` placeholder for the project name.

Click "Custom Recipes" in the dialog to view, add, edit, or remove recipes. Recipes are persisted in the app config.

Recipes with `applySetupFiles` enabled will copy files from the "Setup Template Directory" (configured in Settings) into the new project after the scaffold command completes successfully. This is where your eslint config, prettier config, CLAUDE.md, etc. live.

### Setup Template Files

Configure a "Setup Template Directory" in Settings (e.g., `~/dotfiles/project-templates`). When a recipe has "Apply setup files" enabled, all files from this directory are recursively copied into the new project after scaffolding completes successfully.

### Configuration

- **Project Templates Directory** — path to a directory where each subdirectory is a template (Settings)
- **Setup Template Directory** — path to config files to copy after recipe scaffolding (Settings)

---

## Semantic Code Search

A fully-local semantic code search engine. Index your codebase and search using natural language — no external API calls required.

### How It Works

1. **Parsing** — Tree-sitter (WASM) parses source files into semantic chunks: functions, classes, methods, interfaces, types, etc.
2. **Embedding** — Each chunk is embedded using a local ONNX model (`all-MiniLM-L6-v2`, 384-dim, ~80MB, downloaded once).
3. **Vector store** — Embeddings are stored in a file-backed vector index (vectra) at `~/Library/Application Support/repohub/code-search-index/`.
4. **Search** — Natural language queries are embedded and matched against stored chunks using cosine similarity.

### Supported Languages

JavaScript, TypeScript, TSX, Python, Rust, Go, Java, Swift. Unsupported file types fall back to blank-line-separated block chunking.

### Usage

1. Navigate to the **Search** tab in the sidebar (or Cmd+K → "Code Search").
2. Click **Start Indexing** — the embedding model downloads on first use (~80MB), then all files in the scan directory are indexed.
3. Type a natural language query (e.g., "function that handles authentication") — results appear ranked by similarity.
4. Click a result's file path to open it in VS Code at the correct line.

### Index Updates

- **File watching** — chokidar monitors indexed directories; changed/added files are automatically re-indexed (1s debounce).
- **Manual reindex** — click the Reindex button to force a full re-scan.
- **Incremental** — only changed files (by content hash) are re-processed during reindex.

### Settings

- **Enable code search** — toggle to enable/disable file watching and indexing (default: enabled).
- **Exclude patterns** — glob patterns to skip during indexing (default: `node_modules`, `.git`, `dist`, `build`, `*.min.js`).
- **Max file size** — files larger than this are skipped (default: 1MB).

### Performance

- No worker threads — `onnxruntime-node` handles threading internally.
- Files are processed sequentially with `setImmediate()` yielding between files to keep the event loop responsive.
- Chunks are embedded in batches of 10.
- Index is loaded into memory (~15MB for 10K chunks); file-backed for persistence.

---

## Port Monitoring

The Ports tab shows all TCP ports currently listening on localhost.

For each port:

- Port number, process name, and PID
- **"Managed"** badge if the process was started by RepoHub
- Link to the originating project (if managed)
- **Open** button to launch `http://localhost:<port>` in the browser
- **Kill** button to terminate the process (sends SIGTERM, then SIGKILL after 3s if still alive)

Port scanning runs on a configurable interval (default: every 5 seconds). It uses `lsof -iTCP -sTCP:LISTEN` under the hood. The port list also refreshes automatically when navigating to the Ports tab.
