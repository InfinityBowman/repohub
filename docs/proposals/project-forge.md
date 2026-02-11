# Project Forge

**Category**: Showstopper
**Effort**: High
**Payoff**: One place to create any project — from a quick template drop to an AI-guided build — with your conventions baked in.
demo is located in `_reference/`

## The Problem

You create projects frequently — tools, experiments, prototypes, sub-apps within existing repos. The most common case is spinning up something like Vite + React + Tailwind + Router inside an existing repo (like a `_reference/` or `_playground/` folder). You have a few go-to stacks you use repeatedly.

Currently project creation is scattered: the existing Quick Scaffold feature handles templates and recipes, but there's no integration with external scaffold tools (better-t-stack, create-vite, shadcn init), no AI-assisted setup, and no way to inherit conventions from your existing projects. Each approach lives in a different place.

## The Feature

Project Forge is the **unified home for all project creation**. It replaces Quick Scaffold and consolidates three ways to create a project:

### Mode 1: Templates (Fast Path)

Your premade stacks, instantly scaffolded. This is what you use 80% of the time.

```
┌──────────────────────────────────────────────────────────────┐
│ Project Forge → Templates                                    │
│                                                              │
│ ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│ │ Vite +  │  │ Express │  │   CLI   │  │ Monorepo│        │
│ │ React + │  │   API   │  │  Tool   │  │  Turbo  │        │
│ │Tailwind │  │         │  │         │  │         │        │
│ └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                              │
│ Folder name: _reference                                      │
│ Location: [Inside current repo ▾]                            │
│                                                              │
│ [Scaffold →]                                                 │
└──────────────────────────────────────────────────────────────┘
```

Templates are directories on disk (configured via `projectTemplatesDir` in settings). Each subdirectory is a template — files get copied instantly. Optionally, AI can tweak configs after copy (e.g., match tsconfig paths to the parent repo, align the Tailwind theme, set up path aliases).

This absorbs everything the existing Quick Scaffold templates feature does.

### Mode 2: CLI Tools (External Scaffolders)

Wrap popular scaffolding CLIs with a nice UI. Instead of alt-tabbing to a terminal and remembering flags, pick a tool and configure it visually.

```
┌──────────────────────────────────────────────────────────────┐
│ Project Forge → CLI Tools                                    │
│                                                              │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│ │ Better T     │  │ create-vite  │  │ create-next  │       │
│ │ Stack        │  │              │  │ -app         │       │
│ └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│ Running: pnpm create better-t-stack@latest my-app            │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ $ pnpm create better-t-stack@latest my-app               │ │
│ │ ✔ Frontend: React (TanStack Router)                      │ │
│ │ ✔ Backend: Hono                                          │ │
│ │ ✔ Database: Drizzle + Turso                              │ │
│ │ ✔ Auth: Better-Auth                                      │ │
│ │ Installing dependencies...                                │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

CLI tools run in a PTY so interactive prompts work naturally. Users can also add custom CLI tools (like custom recipes in the old Quick Scaffold). The tool list is user-configurable — add any `create-*` or `init` command.

Supported out of the box:

- **better-t-stack** — Full-stack TypeScript (Hono/Express, Drizzle/Prisma, React/Next/Svelte, Turso/Neon)
- **create-vite** — Vite with any framework
- **create-next-app** — Next.js
- **shadcn init** — Add shadcn/ui to an existing project
- **cargo init** / **go mod init** — Non-JS projects
- Custom commands (user-added, same as the old recipes system)

### Mode 3: AI Forge (Conversational)

For when you want something more custom or exploratory. Describe what you want to build, the AI asks smart follow-up questions, then generates the project.

```
┌──────────────────────────────────────────────────────────────┐
│ Project Forge → AI Forge                                     │
│                                                              │
│ What do you want to build?                                   │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ A CLI tool that watches a directory and automatically    │ │
│ │ optimizes images when new ones are added                 │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Forge: Nice. A few questions:                                │
│                                                              │
│ Language?                                                     │
│ [TypeScript ✓]  [JavaScript]  [Go]  [Rust]                  │
│                                                              │
│ Image library?                                               │
│ [sharp ✓]  [imagemin]  [squoosh]                            │
│ "sharp is fastest — native C++ via libvips"                  │
│                                                              │
│ [Generate Project →]                                         │
└──────────────────────────────────────────────────────────────┘
```

The AI asks _smart_ questions tailored to what you're building — not a generic form. It knows that a CLI image tool needs to pick an image library. It makes recommendations with reasoning. After your answers, it generates actual starter code with the right patterns, not just empty boilerplate.

This is the most powerful mode but also the slowest. Use it for novel projects where you don't have a template and no CLI tool covers your exact setup.

### Convention Inheritance (Shared Across All Modes)

All three modes benefit from convention scanning:

- Scans your existing repos for common patterns (tsconfig settings, package.json scripts, linter configs)
- Applies conventions automatically to new projects
- "You use `strict: true` and `ESM` in all your TypeScript projects — applied."
- "You typically use `vitest` for testing — included."

Templates can be auto-updated with convention changes. CLI tool configs can be pre-filled based on detected conventions. AI Forge uses conventions as context for its recommendations.

You can also define explicit conventions in settings:

```
Default conventions:
- TypeScript: strict, ESM, path aliases
- Testing: vitest
- Linting: biome
- Package manager: pnpm
- Always generate CLAUDE.md
```

### "Forge from Reference"

Available in AI Forge mode. Point at an existing repo:

"Make a new project like `my-api` but for a different domain"

The forge analyzes the reference project's structure, tech stack, and patterns, then generates a new project with the same bones but different business logic.

### Scaffolding Within Existing Repos

A key distinction from standalone project creation tools: Project Forge primarily scaffolds **within existing repos**. The default "Location" is a subfolder of the current repo, not a new standalone directory. This matches the most common workflow — spinning up a sub-app, a `_reference/` folder, a `packages/new-thing` in a monorepo.

The location picker offers:

- Inside current repo (subfolder name)
- Repos directory (creates a new repo alongside existing ones)
- Custom path

### Post-Forge Actions

After any mode completes:

- **Open in VS Code** — Opens the new project folder
- **Launch Agent** — Starts a Coder agent (from Agent Command Center) pre-loaded with the project context
- **Open Terminal** — Opens a terminal in the new project
- **View in Finder** — Opens the folder

For AI Forge specifically, the agent handoff passes the forge's decisions as context so the agent already knows the stack, libraries, and conventions.

## Technical Approach

### Architecture

Project Forge replaces Quick Scaffold. The existing `ScaffoldService` gets refactored into `ForgeService` with three backends:

```typescript
class ForgeService extends EventEmitter {
  // Template mode
  listTemplates(): Template[];
  scaffoldTemplate(templateId: string, outputPath: string, options?: TemplateOptions): Promise<void>;

  // CLI tool mode
  listCLITools(): CLITool[];
  runCLITool(toolId: string, outputPath: string, args: string[]): string; // returns PTY session ID
  addCustomCLITool(tool: CLITool): void;
  removeCustomCLITool(toolId: string): void;

  // AI Forge mode
  startForge(description: string, referenceRepoId?: string): string;
  answerQuestion(forgeId: string, answers: Record<string, string>): void;
  cancelForge(forgeId: string): void;
  getForgeStatus(forgeId: string): ForgeSession;

  // Shared
  scanConventions(): Promise<Conventions>;
  getDefaultConventions(): Conventions;
  setDefaultConventions(conventions: Conventions): void;
}
```

### AI Backend (AI Forge Mode Only)

The AI Forge uses Claude Code as the engine:

- Launch a claude CLI process with a system prompt that guides the forge flow
- The agent asks questions, generates files, installs deps — all through normal Claude Code tool use
- RepoHub wraps the conversation in a structured UI (question chips, progress indicators)
- The forge is essentially a specialized agent with a "project creator" role

### Convention Scanning

```typescript
class ConventionScanner {
  async scanConventions(repos: Repository[]): Promise<Conventions> {
    // Check tsconfig.json across repos → find common settings
    // Check package.json → find common deps, scripts, config
    // Check for common config files (biome, eslint, prettier)
    // Check CLAUDE.md patterns
    return conventions;
  }
}
```

Runs on demand (not continuously) and caches results.

### CLI Tool Registry

```typescript
interface CLITool {
  id: string;
  name: string;
  description: string;
  command: string; // e.g. "pnpm create better-t-stack@latest"
  args?: string; // default args/flags
  interactive: boolean; // whether it has interactive prompts (runs in PTY)
  icon?: string; // lucide icon name
  builtin: boolean; // shipped with RepoHub vs user-added
}
```

Built-in tools ship with sensible defaults. Users can add custom tools (absorbing the old "recipes" concept from Quick Scaffold).

### IPC Channels

- `forge:list-templates`, `forge:scaffold-template`
- `forge:list-cli-tools`, `forge:run-cli-tool`, `forge:add-cli-tool`, `forge:remove-cli-tool`
- `forge:start-ai`, `forge:answer`, `forge:cancel`, `forge:get-status`
- `forge:scan-conventions`, `forge:get-conventions`, `forge:set-conventions`
- Events: `forge:question`, `forge:progress`, `forge:done`, `forge:cli-output`

### Renderer Components

- `ForgeView` — Main view with mode picker (Templates / CLI Tools / AI Forge)
- `TemplateGrid` — Grid of available templates with one-click scaffold
- `CLIToolPicker` — Grid of CLI tools with embedded PTY terminal
- `AIForgeFlow` — Multi-step wizard: describe → questions → progress → done
- `ConventionBadges` — Shows detected conventions
- `ForgeDoneStep` — Success screen with post-forge actions

### Migration from Quick Scaffold

Quick Scaffold's existing functionality maps cleanly:

- **Templates** → Forge Templates mode (same directory scanning, same copy behavior)
- **Recipes** → Forge CLI Tools mode as custom tools (same PTY execution)
- **Cmd+K "New Project"** → Opens Project Forge instead of ScaffoldDialog
- **Settings: `projectTemplatesDir`** → Stays the same, used by Forge Templates mode

## Wow Moments

**Template drop (2 seconds)**: Cmd+K → "forge" → click "Vite + React + Tailwind" → type folder name → done. Your go-to stack is ready with your conventions already applied.

**CLI tool wrap (30 seconds)**: Want a full-stack TypeScript project? Click "Better T Stack", it runs the interactive CLI in a PTY right inside RepoHub. Pick your options, it scaffolds, you're done without leaving the app.

**AI Forge (60 seconds)**: "I need a CLI tool that optimizes images." The AI asks 4 smart questions, you click through chips in 15 seconds. It generates the project with your tsconfig conventions, your preferred structure, a CLAUDE.md, working starter code, and installs deps. Click "Launch Agent" and immediately start building features.

## Scope

- **Phase 1**: Unified Forge UI with Templates mode (migrate from Quick Scaffold) + CLI Tools mode (better-t-stack, create-vite, custom commands)
- **Phase 2**: AI Forge mode — conversational setup, question chips, generation progress
- **Phase 3**: Convention scanning from existing repos, default conventions in settings
- **Phase 4**: "Forge from reference" mode, post-forge agent handoff, convention sync across projects
