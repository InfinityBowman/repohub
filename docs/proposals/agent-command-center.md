# Agent Command Center

**Category**: Showstopper
**Effort**: High
**Payoff**: RepoHub becomes the reason you don't need 6 terminal tabs. It's where you see, control, and coordinate all your AI agents from one screen.
demo is located in `_reference/`

## The Problem

You're running Claude Code in 3 different terminals for 3 different repos. You Cmd+Tab between them, lose track of which one is waiting for input, can't see what they're all doing at once, and each agent only knows about its own repo. Starting a new session means opening a terminal, cd-ing, and launching claude. There's no central place to see "what are all my agents doing right now?"

Meanwhile, tools like OpenAI's Codex app and projects like clawdbot are proving there's a better way — a command center for AI agents.

## The Feature

### Multi-Agent Dashboard

A new primary view in RepoHub with two switchable layouts: **Focused** and **Grid**. A segmented toggle in the header switches between them. Both share the same agent data and state.

#### Focused View (default)

Browser-style tabs along the top, full-width terminal below. Each agent is a tab. One agent visible at a time with maximum terminal real estate.

```
┌─ Header ────────────────────────────────────────────────────────┐
│ Agents  ● 1 working · ◐ 1 thinking · ⬤ 1 waiting   [≡][⊞]    │
│                                           [Context] [+ New Agent]│
├─ Tabs ──────────────────────────────────────────────────────────┤
│ [● my-api 💻 ✕] [⬤ web-app 👁 ✕] [◐ shared-lib 🔍 ✕] [○ cli] [+]│
├─ Info Bar ──────────────────────────────────────────────────────┤
│ Add rate limiting to all API endpoints · ⏱ 2m · 12.8k tokens   │
├─ Terminal (edge-to-edge) ───────────────────────────────────────┤
│                                                                 │
│ > Add rate limiting to all API endpoints using express-rate-limit│
│                                                                 │
│ ◆ I'll add rate limiting to the API. Let me first check the    │
│   existing middleware setup and route structure.                 │
│                                                                 │
│ ⟫ [Read] Reading src/middleware/index.ts                        │
│ ⟫ [Read] Reading src/routes/api.ts                              │
│ ⟫ [Read] Reading package.json                                   │
│                                                                 │
│ ◆ I can see you have Express with middleware in src/middleware/. │
│   I'll create a rate limiter middleware with sensible defaults.  │
│                                                                 │
│ ⟫ [Bash] Installing express-rate-limit...                       │
│ ⟫ [Write] Writing src/middleware/rateLimiter.ts                  │
│ ▌                                                               │
│─────────────────────────────────────────────────────────────────│
│ > Message my-api agent...                                [Send] │
└─────────────────────────────────────────────────────────────────┘
```

**Tab strip**: Apple-style rounded pill tabs with status dot, repo name, role icon (with tooltip), and close button. Completed agents are dimmed. "+" button at the end opens the inline new agent form.

**Info bar**: Task description, elapsed time, token count, files changed. Clickable for full agent details popover. Restart/stop controls on the right.

**Terminal**: Edge-to-edge (extends beyond normal content padding). Shows the full agent conversation with color-coded messages: purple `>` for user, blue `◆` for agent, gray `⟫` for tool use. Tool use lines are clickable to show input/output details in a popover.

#### Grid View

All agents visible simultaneously in a tiled grid. Good for monitoring multiple agents at a glance.

```
┌─ Header ────────────────────────────────────────────────────────┐
│ Agents  ● 1 working · ◐ 1 thinking · ⬤ 1 waiting   [≡][⊞]    │
├─ Grid ──────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│ │ ● my-api / Coder    │  │ ⬤ web-app / Reviewer            │   │
│ │ Adding rate limit... │  │ Waiting for input                │   │
│ │                      │  │                                  │   │
│ │ ⟫ [Bash] pnpm add...│  │ ◆ Should I suggest a fix for    │   │
│ │ ⟫ [Write] rateLim...│  │   the race condition?            │   │
│ │                      │  │                                  │   │
│ │ ⏱ 2m · 12.8k tokens │  │ ⏱ 5m · 8.4k tokens              │   │
│ └──────────────────────┘  └──────────────────────────────────┘  │
│ ┌──────────────────────┐  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│ │ ◐ shared-lib         │  ╎                                  ╎  │
│ │ Researching...       │  ╎        + Launch Agent            ╎  │
│ │                      │  ╎                                  ╎  │
│ │ ⟫ [Read] validation..│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
│ └──────────────────────┘                                        │
├─ Completed ─────────────────────────────────────────────────────┤
│ ○ cli-tool / Coder · "Add --json output flag" · 15m ago        │
└─────────────────────────────────────────────────────────────────┘
```

Each tile shows a compact terminal preview (last 4 messages). Clicking a tile expands it to a full terminal view with a "Back to grid" button. The dashed "Launch Agent" tile opens the inline new agent form when clicked.

#### Status Indicators

- Green dot (with ping animation) = actively working (executing tools)
- Blue spinner = thinking/reasoning
- Amber dot (with ping animation) = waiting for your input
- Gray dot = completed
- Red dot = error

### Agent Roles

When launching an agent, pick a role that shapes its system prompt and behavior:

| Role | What it does | Typical use |
|------|-------------|-------------|
| **Coder** | Writes features, fixes bugs, implements things | "Add auth to the API" |
| **Reviewer** | Reviews uncommitted changes, finds issues, suggests fixes | "Review my changes before I commit" |
| **Researcher** | Explores code, reads docs, investigates approaches | "How does the auth work in this project?" |
| **Architect** | Discusses design, helps plan before coding | "Help me plan how to add real-time features" |
| **Tester** | Writes and runs tests, checks coverage | "Add tests for the auth module" |
| **Security** | Audits code for vulnerabilities, checks deps | "Audit this project for security issues" |
| **Custom** | User-defined system prompt | Whatever you need |

Roles are just pre-configured system prompts + permission sets. The Reviewer role gets read-only tools. The Coder gets full access. The Researcher can read and search but not write. You can customize any of these.

### Agent Launch Flow (Inline Panel)

When the user clicks "New Agent" (header button), "+" (tab strip in Focused view), the dashed tile (Grid view), or the empty state button, the setup form appears **inline** — no modal or popover. The space where the agent will live transforms into the configuration form. This keeps the flow seamless: you're configuring the agent in the exact spot it will occupy once launched.

#### Focused View: New Tab

Clicking "+" in the tab strip creates a new tab labeled "New Agent" with a sparkle icon. The terminal area becomes the setup form:

```
┌─ Tabs ──────────────────────────────────────────────────────────┐
│ [● my-api ✕] [● web-app ✕] [✦ New Agent ✕]              [+]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Repository ──────────────────────────────────────────────┐  │
│  │ 🔍 Search repositories...                                │  │
│  │                                                           │  │
│  │  my-api          Node.js API      main  ↑2 ↓0            │  │
│  │  web-app         React frontend   feat/auth  ●3           │  │
│  │  shared-lib      TypeScript lib   main  ✓                 │  │
│  │  cli-tool        Go CLI           main  ✓                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Role ────────────────────────────────────────────────────┐  │
│  │  [💻 Coder]  [👁 Reviewer]  [🔍 Researcher]              │  │
│  │  [🧪 Architect]  [🧪 Tester]  [🛡 Security]              │  │
│  │                                                           │  │
│  │  Coder — Writes features, fixes bugs, implements things.  │  │
│  │  Has full read-write access. Can install packages and     │  │
│  │  run commands.                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Task ────────────────────────────────────────────────────┐  │
│  │ What should this agent do?                                │  │
│  │ ▌                                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Mode: [● Supervised] [○ Autonomous]     [Launch Agent →]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Once "Launch Agent" is pressed, the tab label transitions from "New Agent" to the repo name + role badge, the form dissolves, and the terminal appears with the agent's first message. The user never left the page.

#### Grid View: Tile Expansion

The dashed "Launch Agent" tile transforms into the setup form, occupying the same grid cell (or expanding to span the grid if needed):

```
┌─ Grid ──────────────────────────────────────────────────────────┐
│ ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│ │ ● my-api / Coder    │  │ ✦ New Agent                [✕]  │   │
│ │ Adding rate limit... │  │                                 │   │
│ │                      │  │ Repo: [my-api ▾]               │   │
│ │ > Installing deps... │  │ Role: [💻 Coder ▾]             │   │
│ │   pnpm add express...│  │                                 │   │
│ │                      │  │ Task: Add error handling to ▌   │   │
│ │ ⏱ 2m · 12.8k tokens │  │                                 │   │
│ └──────────────────────┘  │ [● Supervised] [○ Autonomous]   │   │
│                           │              [Launch Agent →]    │   │
│                           └─────────────────────────────────┘   │
│ ┌──────────────────────┐  ┌──────────────────────────────────┐  │
│ │ ◐ shared-lib         │  │ ● web-app / Reviewer            │  │
│ │ Researching...       │  │ Waiting for input                │  │
│ └──────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

The Grid view uses a more compact form — dropdown selectors instead of the full searchable list — since the tile has less space. After launch, the tile becomes a regular agent tile.

#### Form Components

**Repository Picker**
- Searchable list of all repos RepoHub manages
- Shows: repo name, project type badge, current branch, git status (ahead/behind/dirty)
- Repos with existing running agents get a subtle indicator
- Recently used repos appear first
- In Grid view: dropdown with search instead of inline list

**Role Picker**
- Grid of role cards (6 built-in + custom)
- Each card: icon, name, one-line description
- Selected card gets highlighted border + expanded description showing permissions
- "Custom" role shows an additional text field for custom system prompt
- Inspired by Maestro's expandable accordion pattern — selecting a role reveals its details inline

**Task Input**
- Multi-line text area (2–4 lines visible, expandable)
- Placeholder: "What should this agent do?"
- Optional — if left blank, agent starts in interactive mode (no initial prompt)
- Cmd+Enter to submit (same as launch)

**Mode Toggle**
- **Supervised** (default): Agent asks for approval before writes. You see tool calls and can approve/deny.
- **Autonomous**: Agent works independently. You see the stream but it doesn't wait for approval.
- Read-only roles (Reviewer, Researcher) default to Autonomous since they can't make changes.

**Advanced Options** (collapsed by default, expandable)
- Custom environment variables (key-value pairs, borrowing from Maestro's AgentConfigPanel pattern)
- Custom system prompt override (pre-filled from selected role)
- Max token budget
- Auto-stop conditions (e.g. "stop after first error", "stop after N tool calls")

#### Keyboard Flow

The inline form is fully keyboard-navigable:
1. Press `+` or `N` when tab strip is focused → opens new agent tab
2. Type to filter repos → Enter to select
3. Tab to role picker → arrow keys to select role → Enter to confirm
4. Tab to task input → type task
5. Cmd+Enter → launch

#### Transition Animation

When "Launch Agent" is clicked:
1. Form fields fade out (150ms)
2. A brief "Connecting..." state shows with a spinner and the agent name
3. Terminal content fades in from below as the PTY connects
4. Tab label updates from "✦ New Agent" to "● repo-name" with status dot

### Task Dispatch (Cmd+K)

For power users, Cmd+K supports direct dispatch without opening the setup form:

```
┌──────────────────────────────────────────────┐
│ > agent my-api coder add rate limiting       │
│──────────────────────────────────────────────│
│ ▸ Launch Agent: my-api / Coder               │
│   "add rate limiting"                        │
│                                              │
│ ▸ Launch Agent: my-api / Researcher          │
│   "add rate limiting"                        │
└──────────────────────────────────────────────┘
```

Cmd+K parses natural language: `agent [repo] [role] [task]`. If repo or role is ambiguous, it suggests options. Selecting one launches immediately — no form needed. This is the fast path for users who know exactly what they want.

- **Autonomous**: Agent works independently, you see results when done
- **Supervised**: Agent asks for approval before making changes (default for write operations)

### Agent Communication

Agents can share context through a **shared scratchpad** per session:

- An agent working on the API can note: "Auth uses JWT with 15min expiry, refresh tokens in httpOnly cookies"
- When you launch an agent in the frontend repo, it can see these notes
- Not automatic cross-talk (that gets noisy) — agents write to the scratchpad, other agents can read it
- You can also write to the scratchpad: "All repos should use zod for validation"

```
┌──────────────────────────────────────────────┐
│ Shared Context                    [Edit]     │
│                                              │
│ • Auth: JWT, 15min access, 7d refresh,       │
│   httpOnly cookies (from: my-api/Coder)      │
│ • Validation: Use zod everywhere (from: you) │
│ • API base: localhost:3001 (from: my-api)    │
│                                              │
└──────────────────────────────────────────────┘
```

### Quick Launch

From any repo card or detail view, a single button to launch an agent:

- Repo card: right-click or hover → "Launch Agent" → pick role → go
- Detail view: "Agent" button in header
- Cmd+K: "agent my-api coder" or just "agent my-api"

The agent starts pre-loaded in the repo's directory with its CLAUDE.md (if it exists) already in context.

### Session History

Past agent sessions are saved and browsable:
- See what an agent did, what files it changed, what it suggested
- Re-launch a completed session to continue where it left off
- Search across past sessions: "when did I last add auth to something?"

## Technical Approach

### Claude Code Integration

RepoHub spawns Claude Code via the CLI in its existing PTY infrastructure:

```typescript
// Launch claude code in a PTY (same as ProcessService.startProcess)
const pty = spawn('claude', ['--print', ...flags], {
  cwd: repoPath,
  env: { ...process.env, /* inject shared context path */ }
})
```

**Two integration paths** (choose based on what's available):

1. **CLI mode**: Spawn `claude` CLI process in a PTY. RepoHub wraps it with role-specific flags/system prompts. This works today.

2. **SDK mode** (future): Use the Claude Code Agent SDK (if/when it supports spawning managed agents programmatically) for tighter integration — structured output, tool approval callbacks, progress events.

Start with CLI mode since it works immediately with existing PTY infrastructure.

### New Service: `AgentService`

```typescript
class AgentService extends EventEmitter {
  launchAgent(config: AgentConfig): string  // returns agentId
  stopAgent(agentId: string): void
  sendMessage(agentId: string, message: string): void
  getRunningAgents(): AgentInfo[]
  getSessionHistory(repoId?: string): AgentSession[]

  // Shared context
  addSharedContext(key: string, value: string, source: string): void
  getSharedContext(): SharedContextEntry[]
}

interface AgentConfig {
  repoId: string
  repoPath: string
  role: AgentRole
  task?: string           // initial prompt
  mode: 'autonomous' | 'supervised'
  systemPrompt?: string   // custom role override
}
```

Internally uses ProcessService PTY spawning (or a parallel implementation) to manage claude CLI processes.

### Role System

Roles are stored as configurable presets:

```typescript
interface AgentRole {
  id: string
  name: string
  icon: string
  description: string
  systemPromptPrefix: string  // prepended to the agent's context
  permissions: 'full' | 'read-write' | 'read-only'
  color: string               // for UI badges
}
```

Default roles ship with the app. Users can edit or add custom roles in Settings.

### Shared Scratchpad

Simple file-based approach:
- `~/Library/Application Support/repohub/agent-context/` directory
- One JSON file per active session group
- Agents get the scratchpad path as an environment variable
- Agents can be instructed (via system prompt) to read/write to it
- RepoHub UI reads the file for display

### IPC Channels

- `agent:launch`, `agent:stop`, `agent:send`, `agent:list`
- `agent:get-history`, `agent:get-session`
- `agent:shared-context-get`, `agent:shared-context-set`
- Events: `agent:output`, `agent:status-changed`, `agent:waiting-for-input`

### Renderer Components

- `AgentCommandCenter` — Main view with header (title, status counts, view toggle, context popover, new agent button)
- `FocusedView` — Tab strip + info bar + full terminal. Tabs are Apple-style rounded pills.
- `TiledGridView` — 2-column grid of agent tiles with compact terminal previews. Expandable to full terminal.
- `AgentTerminal` — Shared terminal renderer for agent conversations (full and compact modes). Color-coded messages with tool detail popovers.
- `AgentLaunchPanel` — Inline form for configuring a new agent (repo picker, role picker, task input, mode toggle). Appears in-place: as a tab in Focused view, as a tile in Grid view.
- `SharedContextPopover` — Popover showing shared context entries with "Add context" action
- `AgentInfoPopover` — Popover showing agent details (PID, started, tokens, files changed, status)
- `EmptyState` — Shown when no agents are running. Centered bot icon + launch button.

### Cmd+K Integration

- "agent" → Launch agent dialog
- "agent [repo-name]" → Launch agent for specific repo
- "agent [repo-name] [role]" → Launch with specific role
- "agents" → Switch to Agent Command Center view
- "dispatch [task description]" → Smart task dispatch

## Wow Moment

You open RepoHub. You see your three active repos. You Cmd+K → "agent my-api coder add rate limiting to all endpoints". An agent spins up in the agent panel. While it works, you Cmd+K → "agent web-app reviewer review my changes". Now you have two agents running, visible side by side. The API coder finishes, you review its changes in the terminal. The reviewer flags an issue in your frontend code. You fix it. All from one screen, zero Cmd+Tab, zero lost context.

Later you dispatch a researcher: "what's the best approach for WebSocket integration in Express?" It reads your codebase, checks patterns, and reports back with a recommendation tailored to your actual code. You discuss architecture with it, then dispatch a coder to implement the plan.

## References

- **UI Mockup**: `_reference/src/mockups/AgentCommandCenter.tsx` — Interactive prototype of both Focused and Grid views with mock data, tab strip, terminal rendering, and shared context popover.
- **Maestro** (`_reference/Maestro/`): Cross-platform Electron app for orchestrating multiple AI coding agents (Claude Code, Codex, etc.). Key patterns borrowed:
  - **Expandable agent config**: Accordion cards that reveal details on selection (used for role picker)
  - **Inline customization**: Custom path, args, env vars shown directly in the creation form rather than a separate settings modal
  - **Nudge message**: Per-session custom system prompt (maps to our task input)
  - **Environment variable injection**: Agent sessions receive contextual env vars (e.g. `MAESTRO_SESSION_RESUMED`). We inject shared context path, role config, repo metadata.
  - **Session isolation**: Each task runs in a fresh subprocess to prevent context bleed between agents
  - **Cmd+K quick actions**: Direct dispatch from command palette with parsed arguments

## Scope

- **Phase 1**: Single agent launch per repo (CLI mode), agent list with status, agent terminal view, Cmd+K "agent" command
- **Phase 2**: Multiple concurrent agents, role system, task dispatch, session history
- **Phase 3**: Shared scratchpad, agent communication, custom roles, autonomous mode
- **Phase 4**: SDK integration (if available), structured tool approval UI, richer status events
