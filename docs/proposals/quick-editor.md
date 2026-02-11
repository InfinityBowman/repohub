# Quick File Editor

**Category**: Quick Win
**Effort**: Medium
**Payoff**: Edit config files, env vars, and small files without opening VS Code. Stay in the cockpit.
demo is located in `_reference/`

## The Problem

You're in RepoHub, looking at a repo. You need to:
- Tweak an env variable in `.env`
- Update a version in `package.json`
- Edit your `CLAUDE.md`
- Check and modify a config file

Right now: open VS Code, find the file, make the edit, save, switch back to RepoHub. For a 5-second edit, that's 15 seconds of context switching. And if you're actively using the agent command center, you don't want to leave.

## The Feature

### Inline File Browser + Editor

A file panel in the repo detail view that lets you browse and edit project files:

```
┌──────────────────────────────────────────────────────────────┐
│ Files                                           [Collapse ▾] │
│ ┌──────────┬───────────────────────────────────────────────┐ │
│ │ ▾ src/   │  .env                              [Save ⌘S] │ │
│ │   index  │  ─────────────────────────────────────────── │ │
│ │   utils  │  1 │ DATABASE_URL=postgres://localhost/mydb  │ │
│ │ ▸ tests/ │  2 │ API_KEY=sk-xxxxxxxxxxxxxxxxxxxx         │ │
│ │ .env  ← │  3 │ PORT=3001                               │ │
│ │ .gitign  │  4 │ NODE_ENV=development                    │ │
│ │ CLAUDE   │  5 │ JWT_SECRET=my-secret-key                │ │
│ │ package  │  6 │                                         │ │
│ │ tsconfig │                                              │ │
│ │          │                                              │ │
│ └──────────┴───────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Key Features

**Smart File Tree**
- Shows project root files + directories
- Important files float to top: `.env`, `package.json`, `CLAUDE.md`, `tsconfig.json`, config files
- Collapse directories you don't need
- File icons by type (reuse existing language detection)
- Gitignored files dimmed or hidden (toggle)

**Lightweight Editor**
- Syntax highlighting (Shiki — already in the project for package.json preview)
- Line numbers
- Basic editing: type, delete, undo/redo, select, copy/paste
- Cmd+S to save
- Unsaved changes indicator (dot on file name)
- No need for full IDE features — this is for quick edits, not development

**What This Is NOT**
- Not VS Code. No extensions, no intellisense, no multi-cursor.
- This is for the 80% of edits that are < 10 lines in config/env/doc files.
- A clear "Open in VS Code" button for when you need the real thing.

### File Type Awareness

Different file types get specialized UIs:

**`.env` files**: Key-value editor with masked secrets
```
┌──────────────────────────────────────────────────┐
│ .env                                     [Raw ↔] │
│                                                  │
│ DATABASE_URL    postgres://localhost/mydb    [✏] │
│ API_KEY         sk-xxxx...xxxx              [👁] │
│ PORT            3001                        [✏] │
│ NODE_ENV        development                 [✏] │
│ JWT_SECRET      ••••••••••                  [👁] │
│                                                  │
│ [+ Add Variable]                                 │
└──────────────────────────────────────────────────┘
```
- Values with "key", "secret", "token", "password" auto-masked
- Click eye icon to reveal
- Toggle between structured view and raw text

**`package.json`**: Already have a preview — extend it to be editable for common fields:
- Scripts: edit/add/remove with one click
- Dependencies: version bump buttons
- Name, description, etc.

**`CLAUDE.md` / markdown files**: Rendered preview with edit toggle
- Read mode: rendered markdown
- Edit mode: raw text with syntax highlighting
- Split view option (edit + preview side by side)

### Quick Access

- Cmd+K: "edit .env in my-api" → Opens file editor directly
- Repo detail view: "Files" section (collapsible, like existing package.json preview but expanded)
- Right-click repo card → "Edit .env" / "Edit CLAUDE.md" (quick access to common files)

## Technical Approach

### File Operations

Extend the existing `repo:read-file` IPC channel and add write capability:

```typescript
// Already exists
ipcMain.handle('repo:read-file', async (_, repoPath, relativePath) => { ... })

// New
ipcMain.handle('repo:write-file', async (_, repoPath, relativePath, content) => {
  // Same path traversal safety check as read-file
  const fullPath = path.resolve(repoPath, relativePath)
  if (!fullPath.startsWith(repoPath)) throw new Error('Path traversal detected')

  await fs.writeFile(fullPath, content, 'utf-8')
})

// New - list directory
ipcMain.handle('repo:list-files', async (_, repoPath, relativePath = '.') => {
  const fullPath = path.resolve(repoPath, relativePath)
  if (!fullPath.startsWith(repoPath)) throw new Error('Path traversal detected')

  const entries = await fs.readdir(fullPath, { withFileTypes: true })
  return entries.map(e => ({
    name: e.name,
    isDirectory: e.isDirectory(),
    path: path.relative(repoPath, path.join(fullPath, e.name))
  }))
})
```

### Editor Component

Use CodeMirror 6 for the editor:
- Lightweight, modular, fast
- Built-in language modes for JSON, YAML, TypeScript, Markdown, env files
- Undo/redo, search/replace, keybindings
- Theme-able to match RepoHub's dark themes
- Much better than building a textarea-based editor

```
pnpm add @codemirror/state @codemirror/view @codemirror/lang-json @codemirror/lang-markdown @codemirror/lang-javascript @codemirror/theme-one-dark
```

Alternative: **Monaco Editor** (VS Code's editor) — more powerful but heavier (5MB+). CodeMirror is ~200KB and sufficient for quick edits.

### File Tree

```typescript
interface FileNode {
  name: string
  path: string          // relative to repo root
  isDirectory: boolean
  children?: FileNode[] // lazy-loaded on expand
  importance: number    // for sorting (config files rank higher)
}

// Importance ranking
const FILE_IMPORTANCE: Record<string, number> = {
  '.env': 100,
  'CLAUDE.md': 95,
  'package.json': 90,
  'tsconfig.json': 85,
  'README.md': 80,
  // ...
}
```

### IPC Channels

- `repo:list-files` — List directory contents
- `repo:write-file` — Write file (with path traversal check)
- `repo:read-file` — Already exists
- `repo:file-exists` — Check if a file exists

### Renderer Components

- `FileExplorer` — Left panel file tree with lazy directory loading
- `QuickEditor` — CodeMirror wrapper with save/undo/theme
- `EnvEditor` — Structured key-value editor for .env files
- `MarkdownPreview` — Rendered markdown with edit toggle
- `FilePanel` — Container for file tree + editor, used in repo detail view

### Preload Bridge Additions

```typescript
// Add to window.electron
repo: {
  // existing
  readFile: (repoPath: string, relativePath: string) => Promise<string>,
  // new
  writeFile: (repoPath: string, relativePath: string, content: string) => Promise<void>,
  listFiles: (repoPath: string, relativePath?: string) => Promise<FileEntry[]>,
}
```

## Wow Moment

You're in the repo detail view, your dev server is running in the terminal below, and the browser preview shows your app above. You need to change an API key in `.env`. Instead of Cmd+Tab to VS Code, find the file, edit, save, Cmd+Tab back — you click `.env` in the file panel right there. Change the value. Cmd+S. The dev server hot-reloads. You see the change in the preview. All without leaving RepoHub.

Or: you launch an agent and it asks about your project conventions. You open `CLAUDE.md` in the quick editor, update a section while the agent waits, then tell it to re-read. Everything stays in one window.

## Scope

- **Phase 1**: File tree browser + read-only file viewer with syntax highlighting (extend existing package.json preview to all files)
- **Phase 2**: Editable files with CodeMirror, Cmd+S save, unsaved indicator
- **Phase 3**: Structured .env editor, markdown preview, Cmd+K file access
