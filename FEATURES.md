# RepoHub Feature Roadmap

Ideas for turning RepoHub from a project launcher into an actual developer cockpit.

---

## Tier 1: High Impact, Buildable Now

### Monorepo Awareness

Corates is a Turbo + pnpm workspace with 12 packages. RepoHub should understand that. Instead of showing `corates` as one node project, expand it into its sub-packages with their own run commands (`turbo run dev --filter=@corates/web`). Show the dependency graph between packages. Let you run a subset of the workspace from one click — like "start the API and the web app but not the docs site."

### Environment Switcher

You run pyenv, nvm, and rbenv. When you launch a project, RepoHub should detect the `.python-version`, `.nvmrc`, or `.ruby-version` file and show which runtime version is expected vs. what's currently active. If they mismatch, show a warning or offer to switch before running. No more "why is this failing" because you're on Node 18 when the project needs 24.

### GitHub Integration

You already have `gh` CLI and a PR-based workflow with issue-number branches. RepoHub should show:

- Current PR status for the checked-out branch (open, draft, merged, CI passing/failing)
- Open PRs across all your repos in a unified view
- One-click to create a PR from the current branch
- Link to the GitHub issues page for the repo

Pull this from `gh api` calls — no OAuth needed since `gh` is already authenticated.

### Docker Compose Dashboard

Two of your projects use docker-compose. When RepoHub detects a `docker-compose.yml`, show the service status (running/stopped), logs per container, and start/stop/restart controls — same UX as the process runner but for containers. One button to `docker compose up -d` the whole stack.

### Dependency Health Panel

For each repo, show a quick health summary:

- Last `npm audit` / `pnpm audit` result count (critical/high)
- How many packages are outdated (`pnpm outdated` summary)
- Lock file age (last modified date)
- Whether the lock file is in sync with package.json

Surface this as a small badge on the repo card — green/yellow/red. Click to see details.

---

## Tier 2: Workflow Multipliers

### Smart Run Profiles

You often need to run multiple things together — the API server, the web frontend, maybe a worker process. Let you define "profiles" per repo (or across repos) that start multiple processes in sequence:

```
"corates-dev": [
  { repo: "corates", command: "pnpm dev --filter=@corates/api" },
  { repo: "corates", command: "pnpm dev --filter=@corates/web" },
  { repo: "corates", command: "stripe listen --forward-to localhost:8787/webhook" }
]
```

One click to spin up your entire dev environment. One click to tear it all down.

### Scratch Terminal

A built-in terminal tab (not tied to any repo) for quick one-off commands. You're already embedding xterm.js — just add a general-purpose terminal pane. Useful for running `gh`, `git` commands, or checking something without switching to Ghostty.

### Quick Notes per Repo

A tiny markdown scratchpad per repo for things like "the staging deploy password is in 1Password under X" or "to reproduce the bug, use account test@example.com." Stored locally, searchable from the filter bar. Beats keeping random sticky notes or browser tabs.

### Process Auto-Restart on File Change

Watch the project directory for file changes and optionally restart the process. Useful for backends that don't have hot reload. Configurable per repo — which file patterns to watch, debounce time, whether to restart or just notify.

### Cloudflare Workers Integration

You use `wrangler` for Corates. Detect `wrangler.toml` files and add:

- Quick deploy button (`wrangler deploy`)
- Tail logs (`wrangler tail`) streamed into the terminal panel
- Show which environment (production/staging) is deployed and when
- D1/KV/Durable Objects status

---

## Tier 3: AI-First Features

### Claude Code Integration

You're a heavy Claude Code user with MCP servers configured. RepoHub could:

- **One-click Claude session**: Open Claude Code in a terminal pane pre-configured for the selected repo, with the right CLAUDE.md context loaded
- **Project summary on hover**: Ask Claude to generate a 2-sentence summary of what a repo does (cached, regenerated on demand). Useful when you have 28+ repos and can't remember what `fre-hmr` was for
- **Smart command suggestion**: When a repo has no detected run command, ask Claude to look at the project structure and suggest one
- **Commit message drafting**: Select a repo with uncommitted changes, click "draft commit" — Claude reads the diff and proposes a message following your style (descriptive, sometimes prefixed with `feat:` / `fix:`)

### AI-Powered Error Detection

When a running process outputs something that looks like an error (stack trace, non-zero exit, "ERROR" / "FATAL" in output), flag it:

- Highlight the repo card in red
- Show a notification
- Offer to "Ask Claude about this error" which opens Claude Code with the error context and the relevant source files pre-loaded

### Natural Language Commands

A command palette (Cmd+K) where you can type things like:

- "start corates" → starts the corates dev server
- "stop everything" → kills all running processes
- "show all python projects" → filters the tree
- "open idle-game in code" → opens VS Code
- "which projects are using React 19?" → searches package.json files and answers

Parse intent locally for simple commands, fall back to Claude for complex queries.

### Codebase Search Across Repos

A global search that greps across all your repos simultaneously. "Where did I implement that JWT refresh logic?" — searches all 28 repos and shows results grouped by project. Much faster than opening each repo individually.

---

## Tier 4: Polish & Power User

### Keyboard-Driven Everything

- `Cmd+K` command palette
- `Cmd+1/2/3` to switch between Repos/Ports/Settings views
- `j/k` to navigate repo list
- `Enter` to expand, `r` to run, `s` to stop
- `Cmd+Shift+T` to open in Ghostty, `Cmd+Shift+C` to open in VS Code
- Vim-style navigation for the whole app

### Resource Monitor per Process

Show CPU and memory usage for each running process in real-time. You're already polling `lsof` for ports — add `ps` polling for resource stats. Show a small sparkline on the repo card when running. Alert if a process is eating > 1GB RAM or pegging CPU (runaway build, infinite loop).

### Notification Center

A slide-out panel showing recent events:

- Process crashed (exit code non-zero)
- Git push completed
- Build finished
- Port conflict detected
- Dependency vulnerability found

macOS native notifications for critical ones (crashes, port conflicts).

### Timeline View

A horizontal timeline showing when processes were started/stopped throughout the day. Useful for understanding your work patterns and debugging "when did this start failing?" Shows process up/down as colored bars on a time axis.

### Repo Archiving

You have repos like `portfolio` (legacy), `ThirdParty`, `backup` that clutter the list. Let you mark repos as "archived" — they're hidden by default but searchable with a toggle. Keeps the tree clean without removing projects from disk.

### Theme Sync

Read your VS Code theme (you use Material Palenight with extensive customizations) and apply matching colors to RepoHub automatically. Same aesthetic across your entire toolchain.

### Multi-Directory Scanning

You might not keep everything in `~/Documents/Repos` forever. Support multiple scan roots — e.g., add `~/work` or `~/experiments` as additional directories. Each shows as a top-level group in the tree.

### Shareable Project Configs

A `.repohub.json` file that lives in the repo root:

```json
{
  "commands": {
    "dev": "pnpm dev",
    "test": "pnpm test",
    "deploy": "wrangler deploy"
  },
  "env": {
    "STRIPE_KEY": "sk_test_..."
  },
  "profile": "node-24",
  "notes": "Run `stripe listen` in a separate terminal for webhooks"
}
```

Version-controlled, so when you clone on a new machine, RepoHub picks it up automatically.

### Convex Integration

You use Convex as a backend for idle-game. Detect `convex/` directories and show:

- Convex dashboard link
- Function deployment status
- Quick `npx convex dev` runner with log streaming
- Schema viewer showing your Convex tables

---

## Wild Ideas

### **RepoHub as MCP Server**

Expose RepoHub itself as an MCP server for Claude Code. Claude could ask RepoHub "what processes are running?", "start the corates dev server", "what ports are in use?" — letting your AI assistant control your dev environment directly through conversation.

### **Git Bisect UI**

Visual git bisect — mark commits as good/bad by clicking on a commit list, and RepoHub runs the bisect for you, showing the result when it finds the culprit.

### **Stale Branch Cleanup**

Show branches that haven't been touched in 30+ days across all repos. One-click to delete merged branches locally and remotely. Keep your git clean without thinking about it.

1. open in github, 2. branch cleanup, 3. package.json hover preview, 4. command palette

common command palette case:
type name of repo - get options to open in code, ghostty, start, check deps, view branches, etc.

### **Project Templates**

"New Project" button that scaffolds from your own repos. Pick `idle-game` as a template, give it a new name — RepoHub clones the structure, resets git history, updates package.json name, and adds it to the tree.
