# 06 — Phased Rollout

## Phase 1: Foundation (MVP)

**Goal**: One agent at a time, basic launch/stop/message, terminal view. Prove the WebSocket integration works.

### Main Process

1. **WebSocket server** (`src/main/services/AgentWebSocketServer.ts`)
   - HTTP + WS server on random port, localhost only
   - Route `/ws/cli/{sessionId}` to AgentService
   - NDJSON parsing and message routing

2. **AgentService** (`src/main/services/AgentService.ts`)
   - `launchAgent(config)` — spawn CLI with `--sdk-url`, wait for connection
   - `stopAgent(sessionId)` — interrupt + kill
   - `sendMessage(sessionId, content)` — forward user message
   - Handle `system/init`, `assistant`, `control_request`, `result` messages
   - Permission auto-approve for autonomous mode
   - Permission forwarding for supervised mode
   - In-memory session state (no persistence yet)
   - EventEmitter for all events

3. **IPC handler** (`src/main/ipc/agent.handler.ts`)
   - `agent:launch`, `agent:stop`, `agent:send-message`, `agent:list`, `agent:get-messages`
   - `agent:respond-permission`
   - Event forwarding: `agent:launched`, `agent:status-changed`, `agent:output`, `agent:permission-request`, `agent:result`, `agent:stream`

4. **Preload bridge** additions
   - `window.electron.agent.*` methods

5. **Built-in roles** (just the role definitions, no settings UI yet)
   - Coder, Reviewer, Researcher — hardcoded

### Renderer

6. **Zustand store** (`src/renderer/src/store/agentStore.ts`)
   - Agent state, messages, permissions, streaming

7. **useAgents hook** (`src/renderer/src/hooks/useAgents.ts`)
   - IPC listeners, actions

8. **AgentCommandCenter view** (`src/renderer/src/views/AgentCommandCenterView.tsx`)
   - Header with status counts
   - FocusedView only (no grid yet)
   - Tab strip (but likely just one tab for now)
   - Info bar with task, time, tokens

9. **AgentTerminal** component
   - Render user messages (purple `>`)
   - Render agent messages (blue `◆`)
   - Render tool use (yellow `⟫` with ToolDetailPopover)
   - Streaming cursor
   - Auto-scroll

10. **PermissionRequestInline** component
    - Inline approve/deny for supervised mode
    - Shows tool name and input

11. **AgentLaunchPanel** component (simplified)
    - Repository picker (select from existing repos)
    - Role picker (3 built-in roles, card grid)
    - Task input (textarea)
    - Mode toggle (supervised/autonomous)
    - Launch button

12. **MessageInput** component
    - Text input at bottom of terminal
    - Send button

13. **EmptyState** component

14. **Routing** — Add `/agents` route

15. **Sidebar** — Add "Agents" nav item

### Files Created (Phase 1)

```
src/main/
├── services/
│   ├── AgentService.ts
│   └── AgentWebSocketServer.ts
├── ipc/
│   └── agent.handler.ts
└── types/
    └── agent.types.ts

src/renderer/src/
├── store/
│   └── agentStore.ts
├── hooks/
│   └── useAgents.ts
├── views/
│   └── AgentCommandCenterView.tsx
└── components/
    └── agents/
        ├── AgentHeader.tsx
        ├── AgentTerminal.tsx
        ├── AgentLaunchPanel.tsx
        ├── PermissionRequestInline.tsx
        ├── MessageInput.tsx
        ├── FocusedView.tsx
        ├── TabStrip.tsx
        ├── InfoBar.tsx
        ├── StatusDot.tsx
        ├── RoleBadge.tsx
        └── EmptyState.tsx

Modified:
├── src/main/index.ts (initialize AgentService + WS server)
├── src/main/ipc/index.ts (register agent handlers)
├── src/preload/index.ts (add agent bridge)
├── src/renderer/src/App.tsx (add route)
└── src/renderer/src/components/layout/Sidebar.tsx (add nav item)
```

### Validation

- Launch a Coder agent for a repo → see it connect → send a task → watch structured output appear
- Launch a Reviewer agent (read-only) → confirm it can read but can't write
- In supervised mode: see permission request inline → approve → tool executes
- Stop an agent → confirm CLI process terminates
- Stream_event messages show live typing

---

## Phase 2: Multi-Agent + Polish

**Goal**: Multiple concurrent agents, grid view, session persistence, cost tracking, diff view.

### Main Process

1. **Multi-agent support** — Allow multiple concurrent sessions in AgentService
2. **Session persistence** — Save completed sessions to electron-store, resume via `--resume`
3. **Cost tracking** — Extract from `result` messages, aggregate across agents
4. **Diff service** — Run `git diff` in agent working directories

### Renderer

5. **GridView** component — 2-column tiled grid with compact terminal previews
6. **ViewMode toggle** — Switch between Focused and Grid
7. **Multiple tabs** in FocusedView — Full tab management (add, remove, switch)
8. **Session resume** — "Resume" button on completed agents
9. **Cost display** — Per-agent and aggregate token/cost in info bar and header
10. **ChangesPanel** — File diff view (from AgentDiffView mockup)
11. **Terminal/Changes toggle** — Switch between terminal and diff view per agent
12. **AgentInfoPopover** — Click task in info bar for full agent details
13. **Shared context** — SharedContextPopover in header, add/remove entries
14. **Desktop notifications** — Electron Notification API for agent complete/error/waiting
15. **Prevent sleep** — `powerSaveBlocker` while agents are working
16. **Sidebar badge** — Show running agent count on sidebar "Agents" item

### New Files (Phase 2)

```
src/renderer/src/components/agents/
├── GridView.tsx
├── AgentTile.tsx
├── CompletedSection.tsx
├── AgentInfoPopover.tsx
├── SharedContextPopover.tsx
├── ChangesPanel.tsx
├── FileDiffView.tsx
├── DiffSummaryBar.tsx
└── CostDisplay.tsx

src/main/services/
└── NotificationService.ts (agent notifications)
```

---

## Phase 3: Context Management + Experience

**Goal**: Context visibility, smart compaction, session intelligence, output filtering.

### Main Process

1. **ContextService** — Parse PTY/WebSocket output into context blocks, token counting
2. **Context operations** — Remove, collapse (AI summary), pin, transfer blocks
3. **Snapshots** — Save/restore context state
4. **Output filtering** — Server-side message filtering by type/pattern
5. **Token estimation** — Count tokens per block for budget visualization

### Renderer

6. **ContextPanel** — Side panel with block viewer (from ContextManagement mockup)
7. **ContextBudgetBar** — Thin progress bar in info bar, clickable
8. **BlockCard** — Individual context block with actions menu
9. **CompactionBanner** — Warning + suggestions when context is high
10. **TransferBar** — Select blocks and transfer to another agent
11. **SnapshotManager** — Save/restore named snapshots
12. **Output filter bar** — Cmd+F in terminal, filter by type/pattern/regex
13. **Auto tab naming** — Generate short names after first turn (Haiku call)
14. **Export conversations** — HTML, Markdown, JSON export

### New Files (Phase 3)

```
src/main/services/
├── ContextService.ts
└── ExportService.ts

src/renderer/src/components/agents/
├── ContextPanel.tsx
├── ContextBudgetBar.tsx
├── BlockCard.tsx
├── BlockDetailPopover.tsx
├── CompactionBanner.tsx
├── TransferBar.tsx
├── SnapshotManager.tsx
├── OutputFilterBar.tsx
└── ExportDialog.tsx
```

---

## Phase 4: Advanced Features

**Goal**: Git worktree isolation, full role system, Cmd+K dispatch, group chat, MCP integration.

### Features

1. **Git worktree isolation** — Auto-create worktrees for Coder agents, merge/PR on completion
2. **Custom roles** — Settings UI for creating/editing roles
3. **Conductor profile** — Global system prompt injection from Settings
4. **Cmd+K agent dispatch** — Parse "agent [repo] [role] [task]" from command palette
5. **Group chat / Moderator** (future) — Multi-agent coordination with moderator AI
6. **Playbooks** (future) — Markdown-based task automation
7. **Execution queue** (future) — Sequential write ops across agents on same repo
8. **MCP integration** — Agent sessions get automatic MCP access to RepoHub context

### New Files (Phase 4)

```
src/main/services/
├── WorktreeService.ts
├── PlaybookService.ts
└── GroupChatService.ts

src/renderer/src/components/agents/
├── WorktreeControls.tsx
├── CustomRoleEditor.tsx
├── PlaybookRunner.tsx
└── GroupChatView.tsx
```

---

## Dependencies

### Phase 1

```bash
pnpm add ws                    # WebSocket server (already available in Node.js?)
```

Check if `ws` is needed or if Node.js built-in `WebSocket`/`WebSocketServer` suffices (Node 21+). Since Electron bundles Node, check the version.

No other new dependencies — we're using Claude Code CLI (must be installed), existing Electron APIs, and existing UI components.

### Phase 2

No new deps — uses electron-store (already installed), Electron Notification API, `powerSaveBlocker`.

### Phase 3

```bash
pnpm add tiktoken              # Token counting for context budget (or use Anthropic's tokenizer)
```

### Phase 4

No new deps for worktrees (just `git worktree` commands). MCP integration uses `@modelcontextprotocol/sdk` (from the MCP proposal).

---

## Risk Mitigation

### `--sdk-url` Flag Stability

This is an undocumented Claude Code CLI flag. Risks:

- Could be removed or changed in future versions
- Behavior may differ across versions

**Mitigation**:

- Pin Claude Code version in docs/requirements
- Implement graceful fallback: if `--sdk-url` fails, fall back to PTY mode with heuristic parsing
- Monitor Claude Code releases for changes
- The Companion app's widespread use of this flag reduces the likelihood of removal

### WebSocket Server Port Conflicts

**Mitigation**: Use port 0 (OS-assigned random port). Store in memory. No fixed port.

### CLI Process Leaks

If RepoHub crashes, spawned Claude processes may linger.

**Mitigation**:

- Write PIDs to a file on launch, clean up on startup
- Use process group IDs so children die when parent dies
- Electron's `app.on('will-quit')` handler to kill all agents

### Permission Mode Security

In autonomous mode, the agent can do anything.

**Mitigation**:

- Default to supervised mode
- Read-only roles always use `plan` mode regardless of user selection
- Show clear warning when selecting autonomous mode for write-capable roles
- Auto-approve logic is explicit in code, easily auditable

---

## Success Metrics

### Phase 1

- Can launch a Claude Code agent from RepoHub
- Can see structured terminal output with color-coded messages
- Can approve/deny tool calls in supervised mode
- Can send follow-up messages to an agent
- Can stop an agent

### Phase 2

- Can run 3+ agents simultaneously
- Can switch between focused and grid views
- Can see cost per agent and aggregate
- Can resume a completed session
- Can view file diffs from agent changes

### Phase 3

- Can see context usage and individual blocks
- Can remove/collapse blocks to free context
- Can transfer context between agents
- Can save/restore snapshots

### Phase 4

- Agents work in isolated git worktrees
- Can create custom roles
- Can dispatch agents from Cmd+K
- MCP integration provides ambient context to agents
