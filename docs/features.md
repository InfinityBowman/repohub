# Features

## Repository Dashboard

The home screen scans a configurable root directory (defaults to `~/Documents/Repos`) and displays all detected projects in a grouped tree view.

### Repository List

Repository cards show the project name, type badge, health badge, git branch, PR status, and quick-action buttons (VS Code, Ghostty, GitHub, Start/Stop/Restart). Clicking a card navigates to its detail view.

Repositories are sorted by last modified time. Use the search bar to filter by name.

### Project Detection

Projects are auto-detected by checking for marker files:

| Project Type | Detection | Default Command |
|---|---|---|
| Monorepo | `pnpm-workspace.yaml` + `package.json` | `turbo dev` (if turbo.json) or `pnpm dev` |
| Node.js | `package.json` | `pnpm dev` / `yarn dev` / `npm run dev` / `bun dev` |
| Rust | `Cargo.toml` | `cargo run` |
| Python | `pyproject.toml` / `requirements.txt` / `setup.py` | `python main.py` |
| Go | `go.mod` | `go run .` |
| Swift | `Package.swift` | `swift run` |
| Java | `pom.xml` / `build.gradle` / `build.gradle.kts` | none |

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

| Badge | Meaning |
|---|---|
| Gray shield | Not yet checked -- click to run a check |
| Spinning | Check in progress |
| Green shield | Healthy -- no vulnerabilities, dependencies up to date |
| Yellow shield | Warnings -- some high-severity vulns or 5+ outdated packages |
| Red shield | Critical -- critical vulnerabilities or 5+ high-severity ones |

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

## Port Monitoring

The Ports tab shows all TCP ports currently listening on localhost.

For each port:
- Port number, process name, and PID
- **"Managed"** badge if the process was started by RepoHub
- Link to the originating project (if managed)
- **Open** button to launch `http://localhost:<port>` in the browser
- **Kill** button to terminate the process (sends SIGTERM, then SIGKILL after 3s if still alive)

Port scanning runs on a configurable interval (default: every 5 seconds). It uses `lsof -iTCP -sTCP:LISTEN` under the hood. The port list also refreshes automatically when navigating to the Ports tab.
