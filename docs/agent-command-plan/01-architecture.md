# 01 — System Architecture

## Overview

The Agent Command Center adds a new vertical slice through all three Electron processes. Each layer has clear responsibilities:

- **Main process**: Agent lifecycle, WebSocket bridge, session persistence
- **Preload bridge**: IPC channel forwarding for agent operations
- **Renderer**: Agent UI (views, terminal, launch panel, context panel)

## Process Model

### Per-Agent Architecture

Each agent is a separate Claude Code CLI process connected via WebSocket:

```
RepoHub Main Process
│
├── WebSocket Server (ws://localhost:{port})
│   ├── /ws/cli/{sessionId}       ← Claude CLI connects here (NDJSON)
│   └── (internal routing)        ← AgentService consumes messages directly
│
├── AgentService
│   ├── Session Map<sessionId, AgentSession>
│   ├── Message History per session
│   ├── Permission Request queue
│   └── Event emitter → IPC → Renderer
│
└── CLI Process Pool
    ├── claude --sdk-url ws://localhost:{port}/ws/cli/{sid1} -p ""
    ├── claude --sdk-url ws://localhost:{port}/ws/cli/{sid2} -p ""
    └── claude --sdk-url ws://localhost:{port}/ws/cli/{sid3} -p ""
```

### Why WebSocket, Not PTY

The original proposal suggested spawning `claude` in a PTY (like ProcessService does for dev servers). The Companion app revealed a better path:

| Aspect              | PTY Approach                         | WebSocket Approach                                         |
| ------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Message parsing     | Regex/heuristic on terminal output   | Typed JSON messages                                        |
| Tool calls          | Buried in terminal text              | Structured `control_request` with tool name, input, output |
| Permission flow     | Not possible (auto-approve or block) | Full approve/deny/modify per tool call                     |
| Token/cost tracking | Parse from output text               | Structured `result` message with usage stats               |
| Session resume      | Complex (replay terminal)            | Native `--resume` flag with session ID                     |
| Status detection    | Heuristic (is it typing? waiting?)   | Explicit `system/init`, `result`, `control_request` states |
| Streaming           | Character-by-character terminal      | Token-level `stream_event` messages                        |

The WebSocket approach gives us structured, typed data at every step. No parsing, no guessing.

### WebSocket Server Design

A lightweight HTTP + WebSocket server runs inside the main process:

```typescript
// Uses Fastify or raw ws library (no Bun — we're in Electron's Node.js)
import { WebSocketServer } from 'ws';
import http from 'http';

class AgentWebSocketServer {
  private server: http.Server;
  private wss: WebSocketServer;
  private port: number; // Random available port

  start(): Promise<number>; // Returns assigned port
  stop(): void;

  // Route incoming CLI connections to AgentService
  handleCLIConnection(ws: WebSocket, sessionId: string): void;
}
```

**Port selection**: Use port 0 to get a random available port. Store in memory. Each RepoHub instance gets its own port — no conflicts.

**Security**: The WebSocket server only listens on `127.0.0.1` (localhost). No external access. Session IDs are UUIDs — unguessable.

## Data Flow

### Agent Launch Flow

```
User clicks "Launch Agent"
    │
    ▼
Renderer: agentStore.launchAgent(config)
    │
    ▼
Preload: window.electron.agent.launch(config)
    │
    ▼
IPC Handler: agent:launch
    │
    ▼
AgentService.launchAgent(config)
    ├── 1. Generate sessionId (UUID)
    ├── 2. Create AgentSession in memory
    ├── 3. Spawn: claude --sdk-url ws://localhost:{port}/ws/cli/{sessionId}
    │        --print --output-format stream-json --input-format stream-json
    │        --verbose -p ""
    │        Additional flags: --system-prompt (role), --cwd (repo path)
    ├── 4. Wait for CLI to connect via WebSocket (with timeout)
    ├── 5. Receive system/init message (capabilities, tools, model)
    ├── 6. If task provided, send as first user_message
    └── 7. Emit 'agent:launched' event → IPC → renderer
```

### Message Flow (Agent Working)

```
Claude CLI thinks & acts
    │
    ▼
CLI → WebSocket → AgentService
    │
    ├── assistant message → store in history → emit agent:output
    ├── control_request (can_use_tool) → store pending → emit agent:permission-request
    ├── stream_event → emit agent:stream (real-time tokens)
    ├── result → update stats → emit agent:completed or agent:result
    └── tool_progress → heartbeat → emit agent:heartbeat
```

### Permission Flow

```
Claude wants to use a tool (e.g., Write file)
    │
    ▼
CLI sends control_request { subtype: "can_use_tool", tool_name: "Write", input: {...} }
    │
    ▼
AgentService stores in pendingPermissions[requestId]
    │
    ▼
Emit agent:permission-request → IPC → Renderer
    │
    ▼
Renderer shows approval UI (inline in terminal or toast)
    │
    ▼
User clicks Allow/Deny
    │
    ▼
Renderer: window.electron.agent.respondPermission(agentId, requestId, { behavior, updatedInput })
    │
    ▼
AgentService builds control_response → sends via WebSocket to CLI
    │
    ▼
Claude Code executes (or skips) the tool
```

## Session State

### In-Memory State (AgentSession)

```typescript
interface AgentSession {
  id: string; // UUID
  config: AgentConfig; // Launch config (repo, role, task, mode)
  cliSessionId?: string; // From system/init — used for --resume
  pid?: number; // CLI process PID
  state: AgentState; // 'starting' | 'connected' | 'working' | etc

  // WebSocket
  cliSocket: WebSocket | null; // CLI's WebSocket connection

  // Messages
  messageHistory: AgentMessage[]; // Full conversation for replay
  pendingPermissions: Map<string, PermissionRequest>;
  pendingMessages: string[]; // Queued while CLI connects

  // Stats
  totalTokens: { input: number; output: number; cache: number };
  totalCostUsd: number;
  startedAt: Date;
  completedAt?: Date;

  // Context (Phase 2+)
  contextBlocks?: ContextBlock[];
  contextUsedTokens?: number;
  contextMaxTokens?: number;
}
```

### Persisted State (electron-store)

Session metadata persisted across app restarts:

```typescript
// Stored in electron-store('agent-sessions')
interface PersistedSession {
  id: string;
  cliSessionId: string; // For --resume
  config: AgentConfig;
  messageHistory: AgentMessage[];
  stats: { tokens: number; cost: number; duration: number };
  completedAt: string;
  status: 'completed' | 'error' | 'interrupted';
}
```

Only completed/stopped sessions are persisted. Running sessions live in memory and are lost on crash (the CLI process dies too, so there's nothing to resume).

## Integration with Existing Services

### ProcessService Separation

AgentService does NOT use ProcessService. They manage different concerns:

- **ProcessService**: Dev servers, build commands — long-running PTY processes with terminal output
- **AgentService**: Claude Code agents — WebSocket-connected CLI processes with structured messages

They share no code. An agent might tell Claude to "start the dev server," but that's Claude running `pnpm dev` via its own Bash tool — not RepoHub's ProcessService.

### RepositoryService Integration

AgentService reads from RepositoryService to populate the launch form:

```typescript
// Get repos for the launch form's repository picker
const repos = repositoryService.getRepositories();

// Get repo details for the agent's working directory
const repo = repositoryService.getRepository(repoId);
const cwd = repo.path;
```

### ConfigService Integration

Agent-related settings stored via ConfigService:

```typescript
interface AgentConfig {
  // Persisted settings
  defaultRole: AgentRole; // default: 'coder'
  defaultMode: 'autonomous' | 'supervised'; // default: 'supervised'
  conductorProfile: string; // injected into all agent prompts
  customRoles: AgentRole[]; // user-defined roles

  // Phase 2+
  worktreeBaseDir: string;
  autoWorktreeForCoders: boolean;
  preventSleepWhileWorking: boolean;
  notificationSettings: NotificationSettings;
}
```

## Error Handling

### CLI Process Death

If the Claude CLI process exits unexpectedly:

1. WebSocket `close` event fires
2. AgentService updates session state to `'error'` or `'disconnected'`
3. Emit `agent:status-changed` → renderer shows error state
4. If `cliSessionId` is available, offer "Resume" button
5. Resume spawns a new CLI with `--resume {cliSessionId}`

### WebSocket Server Crash

If the WebSocket server crashes (unlikely but possible):

1. All CLI connections drop simultaneously
2. AgentService marks all sessions as `'disconnected'`
3. Restart the WebSocket server on a new port
4. For each session with a `cliSessionId`, spawn new CLI with `--resume`

### Timeout Handling

- CLI connection timeout: 15 seconds after spawn. If no WebSocket connection, mark as error.
- Permission request timeout: Configurable (default 5 minutes for supervised, instant approve for autonomous).
- Idle timeout: Optional — stop agents that have been waiting for input > N minutes.
