# Agent Command Center — Research & Competitive Analysis

**Purpose**: Comprehensive research into the best AI agent interaction UIs, protocols, and patterns to inform RepoHub's Agent Command Center design. This document surveys the landscape as of February 2026 and identifies what to steal, what to avoid, and what to innovate on.

## Table of Contents

1. [Reference Projects (cloned to `_reference/`)](#reference-projects)
2. [The Big Three: Claude Code, Codex, OpenCode](#the-big-three)
3. [Multi-Agent Orchestrators](#multi-agent-orchestrators)
4. [Emerging Protocols & Standards](#emerging-protocols--standards)
5. [UI Component Patterns](#ui-component-patterns)
6. [WebSocket Protocol Deep Dive](#websocket-protocol-deep-dive)
7. [Key UX Patterns](#key-ux-patterns)
8. [Competitive Feature Matrix](#competitive-feature-matrix)
9. [What RepoHub Should Steal](#what-repohub-should-steal)
10. [What RepoHub Can Uniquely Do](#what-repohub-can-uniquely-do)

---

## Reference Projects

Cloned into `_reference/` for source-level study:

| Project            | Path                    | What It Is                                              | Why It Matters                                                                                      |
| ------------------ | ----------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Maestro**        | `_reference/Maestro/`   | Electron app for orchestrating multiple AI agents       | Primary inspiration — multi-agent UI, worktrees, playbooks, cost tracking                           |
| **Vibe Companion** | `_reference/companion/` | Web UI for Claude Code via reverse-engineered WebSocket | Complete `--sdk-url` protocol doc, real message rendering code                                      |
| **OpenCode**       | `_reference/opencode/`  | Open-source terminal AI coding agent (102K+ stars)      | Client/server arch, provider-agnostic, dual agent modes                                             |
| **Codex App**      | (macOS app, Feb 2 2026) | OpenAI's multi-agent desktop command center             | Thread-per-task, auto-worktrees, automations + review queue, diff w/ inline comments, skills system |
| **Codex CLI**      | `_reference/codex/`     | OpenAI's CLI coding agent (Rust)                        | Plan/review/code modes, sandbox policies, apply_patch system                                        |
| **Aider**          | `_reference/aider/`     | AI pair programming in terminal (4.9M installs)         | Repo map, voice-to-code, auto git commits, lint/test integration                                    |
| **Goose**          | `_reference/goose/`     | Block's open-source autonomous agent (Rust)             | MCP-first extensibility, sub-agents, desktop + CLI dual mode                                        |

---

## The Big Three

### Claude Code

**Type**: Terminal CLI + IDE extensions (VS Code, JetBrains)
**Protocol**: NDJSON over WebSocket (`--sdk-url`) or stdin/stdout (`--output-format stream-json`)
**Stars**: ~47K

**Key UI/UX patterns**:

- **Thinking animation**: Subtle shimmer animation during thinking state
- **Dynamic task list**: Adjusts visible items based on terminal height
- **Status indicators**: "Reading"/"Searching" while in progress → "Read"/"Searched" when complete
- **Plan Mode**: Extended thinking for comprehensive strategy before coding
- **Agent Teams**: Experimental multi-agent collaboration (Opus 4.6)
- **Plugin system**: Official marketplace with 36+ curated plugins (launched Dec 2025)
- **1M token context window** (beta with Opus 4.6)

**What to steal**: The `--sdk-url` WebSocket protocol is the most important technical detail. It's how we spawn and communicate with Claude Code agents. Full protocol documented in `_reference/companion/WEBSOCKET_PROTOCOL_REVERSED.md`.

### OpenAI Codex App (macOS Desktop — Feb 2, 2026)

**Type**: Native macOS desktop app — multi-agent command center
**Protocol**: App Server (JSON-RPC) communicating with Codex core engine
**Model**: GPT-5.3-Codex

**This is our closest competitor.** The Codex app is a desktop "command center for agents" that manages multiple parallel coding agents — exactly what RepoHub's Agent Command Center aims to be.

**Key UI/UX patterns**:

- **Thread-based multi-agent**: Each task is a "thread" within a project. Multiple threads run in parallel, each with its own agent. Users switch between threads while maintaining context.
- **Built-in worktrees**: Each agent gets an isolated git worktree automatically — no conflicts between parallel agents working on the same repo. Users can check out changes locally to review or let agents continue without touching local git state.
- **Diff pane**: Integrated git diff view with inline commenting. Users can stage or revert specific chunks or entire files. Comment on diffs and Codex addresses the feedback.
- **Automations + Review queue**: Define scheduled tasks (instructions + optional skills) that run in the background on a schedule. Results land in a review queue for async review. OpenAI uses this internally for daily issue triage, CI failure summaries, release briefs, and bug detection.
- **Per-thread terminal**: Each thread has a built-in terminal scoped to that project/worktree (`Cmd+J` toggle). Validate changes, run scripts, git operations without leaving the app.
- **Skills system**: Reusable agent capabilities — view, explore, and share skills across projects via a Skills sidebar picker. Skills can be explicitly invoked or auto-selected.
- **IDE sync**: When the Codex IDE Extension runs alongside the app in the same project, automatic syncing occurs. "Auto context" tracks files you view for implicit referencing.
- **Three execution modes**: Local (direct project dir), Worktree (isolated git worktree), Cloud (remote execution environment)
- **Voice dictation**: Hold `Ctrl+M` for transcription-based prompting in the composer
- **Image input**: Drag-and-drop images or request system screenshots for visual context
- **Customizable personalities**: Terse/pragmatic vs conversational/empathetic styles
- **Notifications**: Background notifications for task completion and approval requests; optional sleep prevention during execution
- **Sandbox controls**: Directory and network access boundaries, defaulting to current project scope
- **Session continuity**: Picks up session history and config from Codex CLI and IDE Extension
- **MCP integration**: Shared MCP settings across all Codex tools (app, CLI, IDE extension)
- **Web search**: Built-in first-party web search with cache or live results

**What to steal**: The thread-per-task model with built-in worktrees is the gold standard for multi-agent desktop UX. The automations + review queue pattern is powerful for async workflows. The diff pane with inline commenting is exactly what our file diff view should look like. The per-thread terminal is a pattern we already have the infrastructure for (PTY process management). The skills system maps to our role/prompt presets.

### OpenCode

**Type**: Terminal TUI (Go, Bubble Tea) + Desktop App + Remote mobile
**Protocol**: Client/server with SSE for real-time updates
**Stars**: 102K+

**Key UI/UX patterns**:

- **Dual agents**: "build" (full access) and "plan" (read-only), switchable with Tab
- **Sub-agents**: `@general` for complex multi-step tasks
- **Client/server architecture**: TUI is just one frontend; can be driven remotely from mobile
- **Leader key system**: `ctrl+x` as leader key (vim-style) for keyboard-first navigation
- **Command palette**: `ctrl+x ctrl+x` with footer keybinding display per command
- **Slash commands**: `/` prefix for quick actions
- **TodoRead/TodoWrite**: Built-in task tracking visible during sessions
- **Provider-agnostic**: Works with 75+ LLMs including local models
- **LSP integration**: Language Server Protocol support for code intelligence
- **MCP extensibility**: Dynamic tool registration with `ToolListChangedNotification`
- **Config hierarchy**: Remote → Global → Custom → Project config sources

**What to steal**: The client/server architecture is relevant because RepoHub IS the server and its agent panel IS the client. The dual agent mode (build/plan) maps to our role system. The Todo tool integration is exactly the kind of structured data we should extract and display.

---

## Multi-Agent Orchestrators

### Maestro (Primary Inspiration)

**GitHub**: [pedramamini/Maestro](https://github.com/pedramamini/Maestro) — Already cloned to `_reference/Maestro/`

**Key patterns we're borrowing**:

- **Expandable agent config**: Accordion cards that reveal details on selection → our role picker
- **Inline customization**: Custom path, args, env vars in creation form (not separate settings modal)
- **Nudge message**: Per-session custom system prompt → our task input
- **Environment variable injection**: Agent sessions receive contextual env vars
- **Session isolation**: Each task in a fresh subprocess to prevent context bleed
- **Cmd+K quick actions**: Direct dispatch with parsed arguments

**Feature set** (what Maestro already ships):

- Git worktrees for parallel isolation
- Auto Run & Playbooks (markdown checklists → sequential agent tasks)
- Group Chat with moderator AI
- Mobile remote control (built-in web server + QR code + Cloudflare tunnel)
- Full CLI (`maestro-cli`) for headless/CI operation
- Dual-mode sessions (AI Terminal + Command Terminal, `Cmd+J` to switch)
- Session discovery (imports existing sessions from all providers)
- Output filtering (include/exclude, regex, per-response filters)
- Slash commands with autocomplete
- Draft auto-save
- Cost tracking (real-time per-session and global)
- Usage dashboard with analytics, heatmaps, CSV export
- Document graph (visual knowledge graph of markdown docs)
- 12 themes
- Power management (prevent sleep while agents work)
- Speakable notifications (TTS)
- Keyboard mastery tracking with gamified ranks

### The Vibe Companion

**GitHub**: [The-Vibe-Company/companion](https://github.com/The-Vibe-Company/companion) — Already cloned to `_reference/companion/`

**Architecture**: Bun + Hono server bridges Claude Code CLI ↔ Browser via WebSocket

**Key patterns**:

- **Message rendering**: `MessageBubble` component with grouped tool use blocks, thinking blocks, markdown rendering
- **Tool visualization**: `ToolBlock` with collapsible detail — icon + label + preview for each tool type:
  - Bash → shows command preview, `$` prefix in expanded view
  - Edit → shows file path + removed/added sections with color coding
  - Write → shows file path + content preview (truncated at 500 chars)
  - Read → shows file path
  - Glob/Grep → shows pattern
  - WebSearch → shows query
- **Tool grouping**: Consecutive same-type tool calls are grouped with a count badge
- **Permission banners**: Inline approval cards with:
  - Icon differentiation (question vs warning)
  - Tool name badge
  - Tool input display (command preview for Bash, diff for Edit, etc.)
  - Allow/Deny buttons + permission suggestion chips ("Allow git:\* for session")
  - Special `AskUserQuestion` rendering with option cards
- **Streaming state**: Per-session streaming text buffer + output token counter + start time
- **Changed files tracking**: Tracks `Edit` and `Write` tool calls per session
- **Session naming**: Auto-generated unique names, manual rename via double-click
- **Task extraction**: Automatically extracts `TaskCreate`/`TaskUpdate`/`TodoWrite` tool calls into a task panel
- **Zustand store**: All state keyed by session ID (messages, streaming, permissions, connection status, tasks, changed files)

**What to steal**: The `ToolBlock` component pattern is excellent — collapsible, type-aware previews. The permission banner with suggestion chips is the gold standard. The task extraction from tool calls is a pattern we should implement.

### Other Notable Orchestrators

| Tool                       | What It Does                            | Key Innovation                                                                                              |
| -------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Agent Deck**             | Terminal session manager on top of tmux | Smart status detection (thinking vs waiting), session forking with context inheritance                      |
| **Ralph TUI**              | AI Agent Loop Orchestrator              | Connects agent to task tracker, autonomous loop: select task → build prompt → run agent → detect completion |
| **TmuxCC**                 | Centralized TUI dashboard               | Monitors multiple agents in tmux panes simultaneously                                                       |
| **Toad** (by Rich creator) | Universal front-end for 12+ agents      | ACP support, notebook-style blocks, SVG export, prompt editor with live markdown                            |

---

## Emerging Protocols & Standards

### Agent Client Protocol (ACP)

- **What**: "LSP for AI coding agents" — JSON-RPC standard for connecting any editor to any agent
- **Created by**: Zed + JetBrains
- **Supported editors**: Zed, JetBrains, Neovim, Marimo
- **Supported agents**: Claude Code, Codex CLI, Gemini CLI, Goose, StackPack
- **Relevance**: If RepoHub wants to be an agent-agnostic orchestrator, supporting ACP means any ACP-compatible agent could be managed through our UI

### AG-UI (Agent-User Interaction Protocol)

- **What**: Open protocol for streaming typed JSON events between agent backends and frontends
- **Created by**: CopilotKit (May 2025)
- **Adopted by**: Google ADK, Microsoft Agent Framework, AWS Strands Agents
- **Event types**: 17 types including `TEXT_MESSAGE_CONTENT`, `TOOL_CALL_START`, `STATE_DELTA`
- **Transport**: HTTP SSE (default) or WebSocket
- **Relevance**: Defines best practices for what events a frontend needs. Even if we don't implement AG-UI directly, its event taxonomy is useful for our store design

### A2UI (Agent-to-User Interface)

- **What**: Google's declarative format for agent-generated UIs
- **How**: Agents produce JSON describing UI components from a trusted catalog; clients render natively
- **Status**: v0.8 Public Preview
- **Relevance**: Future consideration — agents could generate custom UI cards in our agent panel

### Claude Code WebSocket Protocol (NDJSON)

- **What**: The undocumented `--sdk-url` WebSocket protocol used by Claude Code CLI
- **Full documentation**: `_reference/companion/WEBSOCKET_PROTOCOL_REVERSED.md` (comprehensive)
- **This is our primary integration mechanism** — see detailed section below

---

## WebSocket Protocol Deep Dive

This is the protocol we use to communicate with Claude Code agents. Full documentation in `_reference/companion/WEBSOCKET_PROTOCOL_REVERSED.md`.

### Connection Flow

```
RepoHub (WS Server)                      Claude Code CLI
     │                                         │
     │◄──────── WebSocket CONNECT ──────────────│  (with Auth header)
     │                                         │
     │──── control_request {initialize} ───────►│  (register hooks, system prompt)
     │◄──── control_response {success} ─────────│  (returns commands, models, account)
     │                                         │
     │──── user message ───────────────────────►│  (first prompt)
     │◄──── system/init ────────────────────────│  (tools, model, session_id)
     │◄──── stream_event (if --verbose) ────────│  (token-by-token)
     │◄──── assistant ──────────────────────────│  (full response with content blocks)
     │                                         │
     │  (if tool needs permission)              │
     │◄──── control_request {can_use_tool} ─────│  (tool_name, input, suggestions)
     │──── control_response {allow/deny} ───────►│  (updatedInput, updatedPermissions)
     │                                         │
     │◄──── result ─────────────────────────────│  (success/error, cost, usage, duration)
```

### Key Message Types (CLI → Server)

| Type                       | Purpose                                                                          |
| -------------------------- | -------------------------------------------------------------------------------- |
| `system/init`              | First message — tools, model, session_id, capabilities                           |
| `system/status`            | Status changes: `compacting`, `null` (done)                                      |
| `system/compact_boundary`  | After context compaction (trigger, pre_tokens)                                   |
| `system/task_notification` | Sub-agent task completed/failed/stopped                                          |
| `assistant`                | Full LLM response with content blocks (text, tool_use, thinking)                 |
| `stream_event`             | Token-by-token streaming (requires `--verbose`)                                  |
| `tool_progress`            | Heartbeat during tool execution (tool_name, elapsed_time)                        |
| `tool_use_summary`         | Summary of preceding tool uses                                                   |
| `result`                   | Query complete — includes `total_cost_usd`, `usage`, `modelUsage`, `duration_ms` |
| `control_request`          | Permission request (`can_use_tool`) or hook callback                             |
| `auth_status`              | Authentication flow status                                                       |

### Key Message Types (Server → CLI)

| Type               | Purpose                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| `user`             | Send prompt or follow-up message                                              |
| `control_response` | Approve/deny tool use, with `updatedInput` and `updatedPermissions`           |
| `control_request`  | `initialize`, `interrupt`, `set_model`, `set_permission_mode`, `rewind_files` |

### Control Protocol Highlights

**`initialize`** (send before first user message):

- Register hooks, MCP servers, custom agents
- Set `systemPrompt` or `appendSystemPrompt` (our role system prompts go here)
- Returns available commands, models, account info

**`can_use_tool`** (permission flow):

- CLI asks permission with `tool_name`, `input`, `permission_suggestions`
- Server responds with `{ behavior: "allow", updatedInput: {...} }` or `{ behavior: "deny", message: "..." }`
- `updatedPermissions` can save rules for the session (e.g., "always allow git commands")
- This is what powers our supervised mode approval cards

**`rewind_files`** (undo):

- Rewind files to a specific user message checkpoint
- Returns `{ canRewind: true, filesChanged, insertions, deletions }` on dry_run
- This enables our "revert changes" feature

### Session Management

- **Session ID**: UUID generated by CLI, included in every message
- **Resume**: `--resume <session-id>` loads previous transcript and continues
- **Fork**: `--resume <session-id> --fork-session` creates new session branching from old one
- **Multi-turn**: After `result`, send another `user` message to continue
- **Context compaction**: CLI auto-compacts and emits `system/status` + `compact_boundary`

### What We Extract for UI

From `result` messages:

- `total_cost_usd` → cost display
- `usage.input_tokens`, `usage.output_tokens` → token counters
- `duration_ms` → elapsed time
- `num_turns` → turn counter
- `modelUsage` → per-model breakdown

From `assistant` messages:

- `content` blocks → render text, tool use, thinking
- `usage` per message → streaming token counter

From `control_request` (`can_use_tool`):

- `tool_name`, `input` → permission card content
- `permission_suggestions` → "Always allow" chips

From `tool_progress`:

- `tool_name`, `elapsed_time_seconds` → "Running bash... 5s" progress indicator

---

## UI Component Patterns

### Message Rendering (from Companion)

The gold standard for rendering agent messages in a web UI:

**Content blocks** are rendered in order:

1. **Text blocks** → Markdown with GFM, syntax-highlighted code blocks with language header
2. **Tool use blocks** → Collapsible `ToolBlock` with icon, label, and type-specific preview:
   - Bash: `$ command` preview, full command in expanded view
   - Edit: file path + removed/added sections with red/green color coding
   - Write: file path + truncated content preview
   - Read: just the file path (last 2 segments)
   - Glob/Grep: pattern
   - WebSearch: query
3. **Thinking blocks** → Collapsible "Thinking" section with char count badge
4. **Tool result blocks** → Bordered box, red if error

**Consecutive same-type tool calls** are grouped into a `ToolGroupBlock` with a count badge and list of previews.

**User messages** → Right-aligned bubble with image attachment support.

**System messages** → Centered italic text with horizontal rules on each side.

### Permission Cards (from Companion)

Two variants:

1. **Tool approval**: Warning icon, "Permission Request" label, tool name badge, tool input preview, Allow/Deny buttons + permission suggestion chips
2. **AskUserQuestion**: Info icon, "Question" label, option cards for selection

Key UX: Permission suggestions let the user "Always allow X for this session" with a single click, reducing approval fatigue.

### Diff Visualization

**Inline diff** (from Companion's `EditToolDetail`):

- File path header
- "removed" section: red-tinted background with old code
- "added" section: green-tinted background with new code

**Full diff view** (from proposal, inspired by review-for-agent):

- File list with change counts (+12 -2)
- Per-file expandable diffs
- Accept All / Revert All / Create PR actions

### Agent Status Indicators

Best practices from across tools:

- Green dot + ping animation = actively working (executing tools)
- Blue spinner/shimmer = thinking/reasoning (LLM generating)
- Amber dot + ping animation = waiting for input
- Gray dot = completed
- Red dot = error

Maestro's color scheme: Green (ready/idle), Yellow (thinking/busy), Red (no connection/error), Pulsing orange (connecting)

### Cost & Token Display

Companion/Maestro pattern:

- Per-message: token count in message metadata
- Per-session: running total in info bar (`⏱ 4m · 18.2k tokens · ~$0.07`)
- Aggregate: total across all agents in header
- Breakdown: per-agent popover with input/output/cache token split

---

## Key UX Patterns

### 1. Structured Message Types

Every tool surveyed renders different message types differently:

| Message Type | Visual Treatment                                                 |
| ------------ | ---------------------------------------------------------------- |
| User prompt  | Right-aligned bubble (Companion) or prefixed with `>` (terminal) |
| Agent text   | Left-aligned with avatar, markdown rendering                     |
| Tool use     | Collapsible card with icon, label, preview                       |
| Tool result  | Muted bordered box (red if error)                                |
| Thinking     | Collapsible section with char count                              |
| System       | Centered italic with horizontal rules                            |
| Permission   | Prominent inline card with action buttons                        |

### 2. Streaming

All modern agent UIs support streaming:

- Token-by-token text rendering (via `stream_event` with `--verbose`)
- Partial message updates (append to last assistant message)
- Streaming stats: output token counter, elapsed time since first token

### 3. Approval Flows

Three tiers observed across tools:

1. **Autonomous**: No approval needed (Codex's full-auto mode, our autonomous mode)
2. **Supervised**: Inline approval cards for each tool call (our default for write operations)
3. **Plan-then-execute**: Agent creates plan, user approves plan, then agent executes (Codex Plan mode, Kiro spec-driven)

Best practice: **Permission suggestions** let users escalate approval granularity ("Always allow bash:git\* for this session") without switching modes entirely.

### 4. Session Management

- **Resume**: All major tools support `--resume <session-id>`
- **Fork**: Branch a conversation without modifying the original
- **Auto-naming**: Generate 2-5 word names from first exchange (Haiku call)
- **Session discovery**: Import existing sessions from CLI history (Maestro)
- **Persistence**: Save to disk, survive restarts

### 5. Context Management

- **Budget bar**: Visual indicator of context window usage (yellow at 80%, red at 95%)
- **Compact button**: Manual trigger for context compaction
- **Auto-compaction**: CLI handles this automatically and emits status events
- **Block viewer**: Show which parts of context are consuming tokens (future)

### 6. Keyboard-First Design

Common shortcuts across tools:
| Action | Shortcut |
|--------|----------|
| New agent/session | `Cmd+N` |
| Quick actions | `Cmd+K` |
| Switch agents | `Cmd+[` / `Cmd+]` |
| Toggle AI/Terminal | `Cmd+J` |
| Focus input | `/` or just start typing |
| Send message | `Enter` or `Cmd+Enter` |
| Interrupt | `Ctrl+C` or `Esc` |

### 7. Multi-Agent Coordination

Three patterns observed:

1. **Side-by-side** (Maestro, our Grid view): Multiple agents visible simultaneously, independent sessions
2. **Group chat** (Maestro): Moderator AI routes messages between agents, synthesizes responses
3. **Shared scratchpad** (our proposal): Agents write to shared context, other agents/user can read

### 8. Rollback & Undo

Patterns from across tools:

- **Git-based**: Auto-commit checkpoints, `git checkout .` to revert (Aider)
- **File rewind**: `rewind_files` control message to restore files to a specific message (Claude Code protocol)
- **Worktree isolation**: Each agent works on a separate git worktree branch (Maestro, our proposal)
- **PR-style review**: review-for-agent tool provides GitHub-style diff view for reviewing uncommitted changes locally

---

## Competitive Feature Matrix

| Feature               | Claude Code                | Codex App (macOS)              | OpenCode           | Maestro                 | Companion           | **RepoHub (Planned)**         |
| --------------------- | -------------------------- | ------------------------------ | ------------------ | ----------------------- | ------------------- | ----------------------------- |
| Multi-agent           | Agent Teams (experimental) | **Yes (threads)**              | No                 | Yes (unlimited)         | Yes (multi-session) | **Yes (core feature)**        |
| Grid/Tiled view       | No                         | No (thread list)               | No                 | No (list only)          | No                  | **Yes**                       |
| Focused view          | N/A (single)               | **Yes (thread focus)**         | N/A (single)       | Yes (tabs)              | Yes (tabs)          | **Yes (tabs)**                |
| Structured messages   | Terminal-only              | **Yes (rich)**                 | Terminal-only      | Pass-through            | **Yes (rich)**      | **Yes (rich)**                |
| Permission cards      | Terminal-only              | **Yes (approval settings)**    | Terminal-only      | Pass-through            | **Yes (inline)**    | **Yes (inline)**              |
| Cost tracking         | Terminal                   | Yes                            | No                 | **Yes (SQLite)**        | No                  | **Yes**                       |
| Session resume        | Yes                        | **Yes (cross-tool)**           | Yes                | **Yes (auto-discover)** | **Yes**             | **Yes**                       |
| Git worktrees         | No                         | **Yes (built-in, per-thread)** | No                 | **Yes**                 | No                  | **Yes**                       |
| Automations           | No                         | **Yes (scheduled + queue)**    | No                 | **Yes (playbooks)**     | No                  | **Yes (future)**              |
| Group chat            | No                         | No                             | No                 | **Yes**                 | No                  | **Yes (future)**              |
| Diff view             | Terminal                   | **Yes (inline comments)**      | Terminal           | **Yes (git diff)**      | No                  | **Yes**                       |
| Per-thread terminal   | N/A                        | **Yes (Cmd+J)**                | N/A                | **Yes (Cmd+J)**         | No                  | **Yes**                       |
| Skills/Roles          | No                         | **Yes (skills system)**        | build/plan         | No (per-agent config)   | No                  | **Yes (6 built-in + custom)** |
| Desktop notifications | No                         | **Yes**                        | No                 | **Yes (TTS)**           | No                  | **Yes**                       |
| Prevent sleep         | No                         | **Yes**                        | No                 | **Yes**                 | No                  | **Yes**                       |
| Voice input           | No                         | **Yes (Ctrl+M)**               | No                 | No                      | No                  | No (future?)                  |
| Image input           | No                         | **Yes (drag-and-drop)**        | No                 | No                      | No                  | No (future?)                  |
| IDE sync              | VS Code ext                | **Yes (auto-context)**         | No                 | No                      | No                  | No                            |
| MCP integration       | Yes                        | **Yes (shared config)**        | Yes                | No                      | No                  | No (future?)                  |
| Provider-agnostic     | Claude only                | OpenAI only                    | **75+ providers**  | **Multi-agent**         | Claude only         | Claude only (initially)       |
| Task tracking         | TodoWrite tool             | No                             | TodoRead/TodoWrite | No                      | **Yes (extracted)** | **Yes (extracted)**           |
| Repo-aware launch     | N/A                        | **Yes (projects)**             | N/A                | No (manual path)        | No                  | **Yes (from repo cards)**     |

---

## What RepoHub Should Steal

### From Companion (Highest Priority)

1. **ToolBlock component pattern**: Collapsible, type-aware previews with icons and labels
2. **Permission banner with suggestion chips**: "Always allow git:\* for session" one-click escalation
3. **Task extraction from tool calls**: Parse `TaskCreate`/`TaskUpdate`/`TodoWrite` into a task panel
4. **Message grouping**: Consecutive same-type tool calls grouped with count badge
5. **Thinking block**: Collapsible with char count
6. **Streaming architecture**: Per-session streaming buffer + token counter in Zustand store

### From Maestro (High Priority)

1. **Keyboard-first everything**: Cmd+K, Cmd+N, agent switching via Cmd+[/]
2. **Session discovery**: Import existing Claude Code sessions
3. **Output filtering**: Include/exclude with regex and presets
4. **Draft auto-save**: Never lose unsent messages
5. **Cost tracking with analytics**: Per-session, daily, weekly trends
6. **Power management**: `powerSaveBlocker` while agents work
7. **Speakable notifications**: System TTS for agent completion

### From Codex App (High Priority — Closest Competitor)

1. **Thread-per-task with auto-worktrees**: Each agent thread gets its own git worktree automatically. This is the pattern we should follow — launch an agent, it gets an isolated branch/worktree, no conflicts with other agents or local state.
2. **Diff pane with inline comments**: Not just a diff view — users can comment on specific lines and the agent addresses the feedback. This is a level above basic diff review.
3. **Automations + Review queue**: Scheduled background tasks that land in a queue for async review. This is what our Playbooks feature should evolve into.
4. **Per-thread terminal (Cmd+J)**: We already have PTY infrastructure — giving each agent thread its own terminal is natural.
5. **Skills system as sidebar picker**: Reusable, shareable prompt presets that can be explicitly invoked or auto-selected. Maps to our role system but more granular.
6. **Three execution modes**: Local / Worktree / Cloud gives users clear mental models for where code runs.
7. **Cross-tool session continuity**: The app picks up sessions from CLI and IDE extension. We should pick up existing Claude Code sessions too.

### From OpenCode (Medium Priority)

1. **Client/server architecture thinking**: RepoHub is the server; agent panel is the client
2. **Dual agent preset**: "build" (full access) and "plan" (read-only) as default quick-start options
3. **Leader key system**: Consider for power-user keyboard navigation
4. **Config hierarchy**: Sensible defaults with per-project overrides

### From review-for-agent (Lower Priority)

1. **Local PR-style diff review**: GitHub-style diff view for reviewing agent changes before accepting

---

## What RepoHub Can Uniquely Do

These are advantages RepoHub has that no other tool in this space offers:

### 1. Repo-Aware Agent Launch

RepoHub already knows about all your repos — their paths, project types, git status, branches, package managers. No other orchestrator has this context. The agent launch flow can pre-populate everything and show relevant context (dirty files, active branches, recent PRs).

### 2. Integrated Repository Dashboard

Agents aren't isolated — they're part of a repo management workflow. You can see a repo's health (dependencies, git status, ports), then launch an agent to fix something, then see the changes reflected in the same dashboard.

### 3. Process & Port Awareness

RepoHub monitors running processes and open ports. When an agent starts a dev server, we can detect the port and show a "Preview" button. When an agent crashes a process, we can show it immediately.

### 4. Monorepo Awareness

RepoHub detects workspace packages. An agent can be launched per-package with the correct working directory, and the workspace structure is visible in the launch form.

### 5. GitHub PR Integration

After an agent finishes work on a worktree, the "Create PR" flow is already built into RepoHub. No need to switch to a terminal or browser.

### 6. Unified Command Palette

Cmd+K already works across all RepoHub features. "agent my-api coder add rate limiting" is just another command in the same palette you use for everything else.

### 7. Native Desktop Experience

Unlike Companion (web) or Maestro (Electron but terminal-focused), RepoHub's agent panel is a native part of a desktop app with proper window management, notifications, and OS integration.

---

## Architecture Recommendations

Based on this research, here are the key architectural decisions:

### 1. Spawn Raw CLI with `--sdk-url` WebSocket (Not the Official SDK)

**Both Companion and Maestro spawn the `claude` CLI binary directly** — neither uses the official `@anthropic-ai/claude-agent-sdk` npm package. This is the right approach for RepoHub too.

**Why raw CLI over the official SDK:**

- **Subscription auth**: The raw CLI inherits the user's logged-in Claude Code subscription (Pro/Max/Team). The official SDK docs explicitly state that third-party apps must use API keys — but spawning the CLI the user already has installed sidesteps this entirely, since the user is running their own CLI.
- **No bundled CLI version**: The SDK bundles its own `cli.js`, which can go stale. Spawning the user's installed `claude` binary means they always get the latest version with their own config, plugins, and settings.
- **Industry consensus**: Every major project (Maestro, Companion, and even Codex's `app-server` for IDE integration) spawns the CLI directly rather than using a wrapper SDK.
- **Full control**: Direct access to all CLI flags (`--sdk-url`, `--resume`, `--fork-session`, `--model`, `--permission-mode`, `--allowedTools`, `--system-prompt`) without SDK abstraction layers.

**Why `--sdk-url` WebSocket over stdin/stdout:**

- **Structured messages**: NDJSON with typed fields, not terminal escape codes to parse
- **Permission flow**: Clean request/response for tool approval (unlike stdin/stdout where permissions are essentially a no-op — see current `AgentService.respondPermission()`)
- **Streaming**: Proper `stream_event` messages with token-level granularity
- **Session management**: `--resume`, `--fork-session`, session IDs
- **Control**: `initialize` to inject system prompts, `interrupt` to stop, `set_model` to switch models
- **Reconnection**: Built-in reconnection logic with message replay
- **Multi-client**: Multiple browser/renderer connections can observe the same session (Companion pattern)

**The spawn pattern (from Companion):**

```bash
claude --sdk-url ws://localhost:{port}/ws/cli/{sessionId} \
  --print --output-format stream-json --input-format stream-json \
  --verbose --model {model} --permission-mode {mode}
```

Our existing `AgentWebSocketServer` + `AgentService` already use this approach. The research confirms this is the right path — but we need to fix the permission flow by properly implementing WebSocket control_request/control_response handling (see `_reference/companion/WEBSOCKET_PROTOCOL_REVERSED.md` §6).

### 2. Message Store Design

Based on Companion's Zustand store pattern, per-session state should include:

- `messages: ChatMessage[]` — full conversation history
- `streaming: string | null` — current partial streaming text
- `streamingStats: { startedAt, outputTokens }` — for live token counter
- `pendingPermissions: Map<requestId, PermissionRequest>` — approval queue
- `sessionStatus: 'idle' | 'running' | 'compacting'` — current state
- `tasks: TaskItem[]` — extracted from tool calls
- `changedFiles: Set<string>` — tracked from Edit/Write tool calls
- `cost: { totalCost, inputTokens, outputTokens, cacheTokens }` — from result messages

### 3. Component Architecture

```
AgentCommandCenter (main view)
├── AgentHeader (status counts, view toggle, context, new agent button)
├── FocusedView
│   ├── TabStrip (Apple-style pill tabs with status dots)
│   ├── InfoBar (task, elapsed, tokens, cost, controls)
│   └── AgentConversation
│       ├── MessageFeed (scrollable message list)
│       │   ├── UserBubble
│       │   ├── AssistantMessage
│       │   │   ├── MarkdownContent (GFM + syntax highlighting)
│       │   │   ├── ToolBlock (collapsible, type-aware)
│       │   │   ├── ToolGroupBlock (grouped consecutive calls)
│       │   │   └── ThinkingBlock (collapsible)
│       │   ├── PermissionCard (approve/deny + suggestion chips)
│       │   └── SystemMessage (centered, muted)
│       └── Composer (message input + send)
├── GridView
│   ├── AgentTile[] (compact conversation preview)
│   └── LaunchTile (dashed "+" tile)
└── AgentLaunchPanel (inline config form)
    ├── RepoPicker (searchable, shows git status)
    ├── RolePicker (grid of role cards)
    ├── TaskInput (multiline, optional)
    └── ModeToggle (supervised/autonomous)
```

### 4. Phase Priorities (Updated)

**Phase 1 — Foundation** (ship first):

- WebSocket server + agent spawn with `--sdk-url`
- Structured message rendering (text, tool use, thinking, tool results)
- Permission cards with approve/deny
- Focused view with tab strip
- Basic info bar (role, task, elapsed time)
- Cost tracking from `result` messages
- Send follow-up messages

**Phase 2 — Polish** (fast follow):

- Grid view for monitoring multiple agents
- Inline agent launch form
- Role system with 6 presets + custom
- Session resume (`--resume`)
- Token-by-token streaming (`--verbose` + `stream_event`)
- Task extraction from tool calls
- Auto tab naming
- Desktop notifications
- Prevent sleep

**Phase 3 — Power Features**:

- Git worktree isolation
- File diff view with accept/revert/PR
- Output filtering (include/exclude, regex, presets)
- Cmd+K agent dispatch
- Shared scratchpad
- Context compaction button
- Export conversations
- Conductor profile

**Phase 4 — Advanced**:

- Group chat with moderator
- Playbooks / Auto Run
- Execution queue
- Session browser with search
- ACP support for non-Claude agents (Codex, OpenCode, Gemini CLI)

---

## Key Sources

### Cloned References

- `_reference/Maestro/` — Maestro source code + CLAUDE.md with full architecture
- `_reference/companion/` — Vibe Companion source + `WEBSOCKET_PROTOCOL_REVERSED.md`
- `_reference/opencode/` — OpenCode source
- `_reference/codex/` — Codex CLI source (Rust)
- `_reference/aider/` — Aider source (Python)
- `_reference/goose/` — Goose source (Rust)

### Documentation

- [Claude Agent SDK TypeScript](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Claude Agent SDK Streaming](https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [Codex CLI Features](https://developers.openai.com/codex/cli/features)
- [OpenCode Docs](https://opencode.ai/docs/)
- [Maestro Docs](https://docs.runmaestro.ai/)
- [AG-UI Protocol](https://docs.ag-ui.com/)
- [ACP Specification](https://github.com/agentclientprotocol/agent-client-protocol)

### Notable Projects

- [Toad](https://github.com/batrachianai/toad) — Universal agent TUI frontend (by Will McGugan)
- [Agent Deck](https://github.com/asheshgoplani/agent-deck) — tmux-based multi-agent manager
- [review-for-agent](https://github.com/Waraq-Labs/review-for-agent) — Local PR-style diff review for AI changes
- [CopilotKit](https://github.com/CopilotKit/CopilotKit) — React framework for agent UIs with AG-UI
- [Cline](https://github.com/cline/cline) — VS Code agent with human-in-the-loop diff review
- [Kilo Code](https://github.com/Kilo-Org/kilocode) — Multi-mode agent (Architect/Code/Debug/Orchestrator)
- [Amp](https://ampcode.com/) — Sourcegraph's agent with Oracle/Librarian sub-agents
